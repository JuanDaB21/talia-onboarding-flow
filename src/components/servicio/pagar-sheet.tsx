import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft,
  Banknote,
  Camera,
  CheckCircle2,
  CreditCard,
  Loader2,
  QrCode as QrCodeIcon,
  Smartphone,
  Ticket,
  X,
  CalendarCheck,
} from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentNegocio } from "@/hooks/use-current-negocio";
import {
  listarItemsCobrables,
  registrarPago,
  registrarPagoDividido,
  type ItemCobrable,
} from "@/lib/pagos.functions";
import {
  listarMetodosPagoQr,
  type MetodoPagoQr,
} from "@/lib/metodos-pago.functions";
import {
  listarBonos,
  previsualizarBono,
  type Bono,
} from "@/lib/bonos.functions";
import {
  listarReservasAplicablesHoy,
  aplicarAbonoEnCheckout,
  type ReservaAplicable,
} from "@/lib/reservas.functions";
import { useNavigate } from "@tanstack/react-router";

const fmt = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

type Metodo = "EFECTIVO" | "TRANSFERENCIA" | "DATAFONO";
type Paso = "items" | "metodo";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  idMesa: string;
}

export function PagarSheet({ open, onOpenChange, idMesa }: Props) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const reservasFn = useServerFn(listarReservasAplicablesHoy);
  const aplicarAbonoFn = useServerFn(aplicarAbonoEnCheckout);

  const itemsQ = useQuery({
    queryKey: ["pagos", "items", idMesa],
    queryFn: () => listarItemsCobrables(idMesa),
    enabled: open,
  });

  const reservasAplicablesQ = useQuery({
    queryKey: ["reservas", "aplicables-hoy"],
    queryFn: () => reservasFn(),
    enabled: open,
  });

  const [paso, setPaso] = useState<Paso>("items");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [metodo, setMetodo] = useState<Metodo>("EFECTIVO");
  // Propina: 10% por defecto. Si el cliente escribe un monto fijo, se usa ese.
  const [propinaPct, setPropinaPct] = useState<number | null>(0.1);
  const [propinaCustom, setPropinaCustom] = useState<number | null>(null);
  const [idBono, setIdBono] = useState<string | null>(null);
  const [idReservaAbono, setIdReservaAbono] = useState<string | null>(null);

  // Reset al abrir
  useEffect(() => {
    if (open) {
      setPaso("items");
      setSelected(new Set());
      setMetodo("EFECTIVO");
      setPropinaPct(0.1);
      setPropinaCustom(null);
      setIdBono(null);
      setIdReservaAbono(null);
    }
  }, [open]);

  const items = itemsQ.data?.items ?? [];
  const pendientes = items.filter((i) => !i.pagado);
  const totalSeleccionado = useMemo(
    () => items.filter((i) => selected.has(i.id_item)).reduce((a, b) => a + b.subtotal, 0),
    [items, selected],
  );

  // Preview del bono según items seleccionados
  const previewFn = useServerFn(previsualizarBono);
  const itemIdsArr = useMemo(() => Array.from(selected), [selected]);
  const bonoPreviewQ = useQuery({
    queryKey: ["bonoPreview", idBono, itemIdsArr],
    queryFn: () =>
      previewFn({
        data: { idBono: idBono!, itemIds: itemIdsArr },
      }),
    enabled: !!idBono && itemIdsArr.length > 0,
  });
  const descuentoBono = bonoPreviewQ.data?.descuento ?? 0;
  const bonoInfo = bonoPreviewQ.data ?? null;

  // Reserva (abono) seleccionado
  const reservasAplicables = reservasAplicablesQ.data ?? [];
  const reservaSel = reservasAplicables.find(
    (r) => r.id_reserva === idReservaAbono,
  ) ?? null;
  // Si el bono no se está usando, el abono cubre todo el subtotal seleccionado.
  // No permitimos mezclar bono + abono de reserva por simplicidad.
  const abonoActivo = !!reservaSel && !idBono;
  const descuentoReserva = abonoActivo
    ? Math.min(reservaSel.monto_abonado, totalSeleccionado)
    : 0;
  const subtotalConDescuentos = Math.max(
    0,
    totalSeleccionado - descuentoBono - descuentoReserva,
  );
  const reservaCubreTodo =
    abonoActivo && reservaSel.monto_abonado >= totalSeleccionado && totalSeleccionado > 0;
  const propina =
    propinaCustom !== null
      ? Math.max(0, Math.floor(propinaCustom))
      : Math.round(subtotalConDescuentos * (propinaPct ?? 0));
  const totalConPropina = subtotalConDescuentos + propina;

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const selectAll = () => setSelected(new Set(pendientes.map((i) => i.id_item)));
  const clear = () => setSelected(new Set());

  type PagarInput = {
    idMesa: string;
    metodo: Metodo;
    subtipo: string | null;
    voucher: string | null;
    urlComprobante: string | null;
    itemIds: string[];
    propina: number;
    idBono: string | null;
    idReserva: string | null;
  };
  const pagarMut = useMutation({
    mutationFn: (input: PagarInput) => registrarPago(input),
    onSuccess: (_res, vars) => {
      const esTransfer = vars.metodo === "TRANSFERENCIA";
      toast.success(
        esTransfer
          ? "Pago registrado · esperando confirmación del admin"
          : "Pago registrado",
        { icon: <CheckCircle2 className="h-4 w-4" /> },
      );
      qc.invalidateQueries({ queryKey: ["mesaSesion", idMesa] });
      qc.invalidateQueries({ queryKey: ["servicio", "mesas"] });
      qc.invalidateQueries({ queryKey: ["pagos"] });
      qc.invalidateQueries({ queryKey: ["caja"] });
      qc.invalidateQueries({ queryKey: ["bonos"] });

      itemsQ.refetch().then((r) => {
        const restantes = r.data?.items.filter((i) => !i.pagado) ?? [];
        if (restantes.length === 0 && !esTransfer) {
          onOpenChange(false);
          navigate({ to: "/servicio" });
        } else {
          setPaso("items");
          setSelected(new Set());
          setPropinaPct(0.1);
          setPropinaCustom(null);
          setIdBono(null);
          setIdReservaAbono(null);
        }
      });
    },
    onError: (e) =>
      toast.error("No se pudo registrar el pago", {
        description: e instanceof Error ? e.message : undefined,
      }),
  });

  type PartePagoInput = {
    metodo: Metodo;
    subtipo: string | null;
    voucher: string | null;
    urlComprobante: string | null;
    monto: number;
  };
  const pagarDivididoMut = useMutation({
    mutationFn: (partes: PartePagoInput[]) =>
      registrarPagoDividido({
        idMesa,
        itemIds: Array.from(selected),
        propina,
        idBono,
        idReserva: abonoActivo ? idReservaAbono : null,
        partes,
      }),
    onSuccess: (_res, partes) => {
      const hayTransfer = partes.some((p) => p.metodo === "TRANSFERENCIA");
      const nTransfer = partes.filter((p) => p.metodo === "TRANSFERENCIA").length;
      toast.success(
        hayTransfer
          ? `Pago dividido registrado · ${nTransfer} transferencia${nTransfer > 1 ? "s" : ""} esperando confirmación`
          : "Pago dividido registrado",
        { icon: <CheckCircle2 className="h-4 w-4" /> },
      );
      qc.invalidateQueries({ queryKey: ["mesaSesion", idMesa] });
      qc.invalidateQueries({ queryKey: ["servicio", "mesas"] });
      qc.invalidateQueries({ queryKey: ["pagos"] });
      qc.invalidateQueries({ queryKey: ["caja"] });
      qc.invalidateQueries({ queryKey: ["bonos"] });
      itemsQ.refetch().then((r) => {
        const restantes = r.data?.items.filter((i) => !i.pagado) ?? [];
        if (restantes.length === 0 && !hayTransfer) {
          onOpenChange(false);
          navigate({ to: "/servicio" });
        } else {
          setPaso("items");
          setSelected(new Set());
          setPropinaPct(0.1);
          setPropinaCustom(null);
          setIdBono(null);
          setIdReservaAbono(null);
        }
      });
    },
    onError: (e) =>
      toast.error("No se pudo registrar el pago dividido", {
        description: e instanceof Error ? e.message : undefined,
      }),
  });


  const abonoMut = useMutation({
    mutationFn: () =>
      aplicarAbonoFn({
        data: {
          idReserva: idReservaAbono!,
          idMesa,
          itemIds: Array.from(selected),
        },
      }),
    onSuccess: () => {
      toast.success("Abono de reserva aplicado", {
        icon: <CalendarCheck className="h-4 w-4" />,
      });
      qc.invalidateQueries({ queryKey: ["mesaSesion", idMesa] });
      qc.invalidateQueries({ queryKey: ["servicio", "mesas"] });
      qc.invalidateQueries({ queryKey: ["pagos"] });
      qc.invalidateQueries({ queryKey: ["caja"] });
      qc.invalidateQueries({ queryKey: ["reservas"] });
      itemsQ.refetch().then((r) => {
        const restantes = r.data?.items.filter((i) => !i.pagado) ?? [];
        if (restantes.length === 0) {
          onOpenChange(false);
          navigate({ to: "/servicio" });
        } else {
          setPaso("items");
          setSelected(new Set());
          setIdReservaAbono(null);
        }
      });
    },
    onError: (e) =>
      toast.error("No se pudo aplicar el abono", {
        description: e instanceof Error ? e.message : undefined,
      }),
  });

  const tituloPaso =
    paso === "items"
      ? "Selecciona los productos a cobrar"
      : "Método de pago";

  const backTo: Paso | null = paso === "metodo" ? "items" : null;

  const propinaProps = {
    propinaPct,
    propinaCustom,
    onPickPct: (pct: number) => {
      setPropinaPct(pct);
      setPropinaCustom(null);
    },
    onCustom: (val: number | null) => {
      setPropinaCustom(val);
      setPropinaPct(null);
    },
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col p-0">
        <SheetHeader className="px-5 pt-5 pb-3 border-b">
          <div className="flex items-center gap-2">
            {backTo && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 -ml-1"
                onClick={() => setPaso(backTo)}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <SheetTitle className="text-lg">{tituloPaso}</SheetTitle>
          </div>
        </SheetHeader>

        {itemsQ.isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : paso === "items" ? (
          <PasoItems
            items={items}
            selected={selected}
            onToggle={toggle}
            onSelectAll={selectAll}
            onClear={clear}
            totalSeleccionado={totalSeleccionado}
            totalPendiente={itemsQ.data?.totalPendiente ?? 0}
            propina={propina}
            propinaProps={propinaProps}
            idBono={idBono}
            setIdBono={setIdBono}
            descuentoBono={descuentoBono}
            bonoInfo={bonoInfo}
            reservasAplicables={reservasAplicables}
            idReservaAbono={idReservaAbono}
            setIdReservaAbono={setIdReservaAbono}
            descuentoReserva={descuentoReserva}
            reservaCubreTodo={reservaCubreTodo}
            onContinue={() => setPaso("metodo")}
            onPagarConAbono={() => abonoMut.mutate()}
            aplicandoAbono={abonoMut.isPending}
          />
        ) : (
          <PasoMetodo
            metodo={metodo}
            setMetodo={setMetodo}
            total={totalSeleccionado}
            propina={propina}
            totalConPropina={totalConPropina}
            propinaProps={propinaProps}
            descuentoBono={descuentoBono}
            descuentoReserva={descuentoReserva}
            bonoInfo={bonoInfo}
            reservaInfo={reservaSel}
            onPagar={(extras) =>
              pagarMut.mutate({
                idMesa,
                metodo,
                subtipo: extras.subtipo ?? null,
                voucher: extras.voucher ?? null,
                urlComprobante: extras.urlComprobante ?? null,
                itemIds: Array.from(selected),
                propina,
                idBono,
                idReserva: abonoActivo ? idReservaAbono : null,
              })
            }
            isLoading={pagarMut.isPending}
            onPagarDividido={(partes) => pagarDivididoMut.mutate(partes)}
            isLoadingDividido={pagarDivididoMut.isPending}
            reservaCubreTodo={reservaCubreTodo}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

type PropinaProps = {
  propinaPct: number | null;
  propinaCustom: number | null;
  onPickPct: (pct: number) => void;
  onCustom: (val: number | null) => void;
};

function PropinaResumenRow({
  propina,
  propinaProps,
}: {
  propina: number;
  propinaProps: PropinaProps;
}) {
  const { propinaPct, propinaCustom, onPickPct, onCustom } = propinaProps;
  const [open, setOpen] = useState(false);
  const [customStr, setCustomStr] = useState<string>(
    propinaCustom !== null ? String(propinaCustom) : "",
  );

  useEffect(() => {
    setCustomStr(propinaCustom !== null ? String(propinaCustom) : "");
  }, [propinaCustom]);

  const etiqueta =
    propinaCustom !== null
      ? "monto fijo"
      : `${Math.round((propinaPct ?? 0) * 100)}%`;

  const opciones = [0, 0.05, 0.1, 0.15];
  const montosFijos = [2000, 5000, 10000, 20000];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex min-h-12 w-full items-center justify-between rounded-lg border bg-background px-3 py-2 text-left transition-colors hover:bg-muted/60"
      >
        <span className="min-w-0">
          <span className="block text-sm font-medium text-foreground">Propina</span>
          <span className="block text-xs text-muted-foreground">{etiqueta}</span>
        </span>
        <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
          {fmt.format(propina)}
        </span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="top-auto bottom-0 max-h-[88dvh] translate-y-0 rounded-t-2xl p-5 sm:top-[50%] sm:bottom-auto sm:max-w-sm sm:translate-y-[-50%] sm:rounded-lg">
          <DialogHeader>
            <DialogTitle>Propina</DialogTitle>
            <DialogDescription>
              Selecciona un porcentaje o define un monto fijo.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 overflow-y-auto">
            <section className="space-y-2">
              <p className="text-xs font-semibold uppercase text-muted-foreground">
                Porcentaje
              </p>
              <div className="grid grid-cols-4 gap-2">
                {opciones.map((pct) => {
                  const active = propinaCustom === null && propinaPct === pct;
                  return (
                    <Button
                      key={pct}
                      type="button"
                      variant={active ? "default" : "outline"}
                      className="h-12"
                      onClick={() => {
                        onPickPct(pct);
                        setCustomStr("");
                      }}
                    >
                      {Math.round(pct * 100)}%
                    </Button>
                  );
                })}
              </div>
            </section>

            <section className="space-y-2">
              <p className="text-xs font-semibold uppercase text-muted-foreground">
                Montos fijos
              </p>
              <div className="grid grid-cols-2 gap-2">
                {montosFijos.map((monto) => {
                  const active = propinaCustom === monto;
                  return (
                    <Button
                      key={monto}
                      type="button"
                      variant={active ? "default" : "outline"}
                      className="h-12"
                      onClick={() => {
                        setCustomStr(String(monto));
                        onCustom(monto);
                      }}
                    >
                      {fmt.format(monto)}
                    </Button>
                  );
                })}
              </div>
            </section>

            <section className="space-y-2">
              <Label htmlFor="propina-custom">Monto variable</Label>
              <Input
                id="propina-custom"
                inputMode="numeric"
                placeholder="Escribe el monto"
                value={customStr}
                onChange={(e) => {
                  const v = e.target.value.replace(/[^\d]/g, "");
                  setCustomStr(v);
                  onCustom(v === "" ? null : Number(v));
                }}
                className="h-12 text-base"
              />
            </section>

            <div className="rounded-lg bg-muted p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Propina actual</span>
                <span className="font-bold tabular-nums">{fmt.format(propina)}</span>
              </div>
            </div>

            <Button className="h-12 w-full" onClick={() => setOpen(false)}>
              Aplicar propina
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function BonoRow({
  idBono,
  setIdBono,
  descuento,
  bonoInfo,
  disabled,
  onEnsureSelection,
}: {
  idBono: string | null;
  setIdBono: (v: string | null) => void;
  descuento: number;
  bonoInfo: BonoPreview | null;
  disabled?: boolean;
  onEnsureSelection: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const listFn = useServerFn(listarBonos);
  const bonosQ = useQuery({
    queryKey: ["bonos", "activos"],
    queryFn: () => listFn({}),
  });
  const bonos = (bonosQ.data?.bonos ?? []).filter((b: Bono) => b.activo);
  const visibles = bonos.filter((b) =>
    b.nombre.toLowerCase().includes(search.trim().toLowerCase()),
  );

  if (!idBono) {
    return (
      <>
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen(true)}
          className="flex min-h-12 w-full items-center justify-between rounded-lg border bg-background px-3 py-2 text-left transition-colors hover:bg-muted/60 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span className="flex min-w-0 items-center gap-2">
            <Ticket className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0">
              <span className="block text-sm font-medium text-foreground">Agregar bono</span>
              <span className="block text-xs text-muted-foreground">
                {disabled ? "No disponible" : "Seleccionar descuento"}
              </span>
            </span>
          </span>
          <span className="shrink-0 text-sm tabular-nums text-muted-foreground">—</span>
        </button>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="top-auto bottom-0 max-h-[88dvh] translate-y-0 rounded-t-2xl p-5 sm:top-[50%] sm:bottom-auto sm:max-w-md sm:translate-y-[-50%] sm:rounded-lg">
            <DialogHeader>
              <DialogTitle>Agregar bono</DialogTitle>
              <DialogDescription>
                Selecciona el bono que se aplicará a los productos marcados.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 overflow-y-auto">
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar bono"
                className="h-12"
              />
              <div className="space-y-2">
                {bonosQ.isLoading && (
                  <div className="flex h-20 items-center justify-center text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                )}
                {!bonosQ.isLoading && visibles.length === 0 && (
                  <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
                    Sin bonos activos
                  </p>
                )}
                {visibles.map((b) => (
                  <button
                    key={b.id_bono}
                    type="button"
                    onClick={() => {
                      onEnsureSelection();
                      setIdBono(b.id_bono);
                      setOpen(false);
                    }}
                    className="flex min-h-14 w-full items-center justify-between gap-3 rounded-lg border bg-card px-3 py-2 text-left transition-colors hover:bg-muted"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-foreground">
                        {b.nombre}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {b.tipo === "VALOR" ? "Valor fijo" : "Porcentaje"}
                      </span>
                    </span>
                    <span className="shrink-0 text-sm font-bold tabular-nums text-primary">
                      {b.tipo === "VALOR"
                        ? `-${fmt.format(b.valor)}`
                        : `-${b.porcentaje ?? 0}%`}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <div className="flex min-h-12 items-center justify-between gap-3 rounded-lg border border-primary/40 bg-primary/5 px-3 py-2 text-sm">
      <div className="flex min-w-0 items-center gap-2 text-emerald-700 dark:text-emerald-400">
        <Ticket className="h-4 w-4 shrink-0" />
        <span className="min-w-0 truncate">
          Bono {bonoInfo ? `· ${bonoInfo.nombre}` : "aplicado"}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 shrink-0 px-2 text-xs text-muted-foreground hover:text-destructive"
          onClick={() => setIdBono(null)}
        >
          Quitar
        </Button>
      </div>
      <span className="tabular-nums font-medium text-emerald-700 dark:text-emerald-400">
        -{fmt.format(descuento)}
      </span>
    </div>
  );
}

type BonoPreview = {
  nombre: string;
  tipo: "PORCENTAJE" | "VALOR";
  porcentaje: number;
  valor: number;
  descuento: number;
  descuento_neto: number;
};


function PasoItems({
  items,
  selected,
  onToggle,
  onSelectAll,
  onClear,
  totalSeleccionado,
  totalPendiente,
  propina,
  propinaProps,
  idBono,
  setIdBono,
  descuentoBono,
  bonoInfo,
  reservasAplicables,
  idReservaAbono,
  setIdReservaAbono,
  descuentoReserva,
  reservaCubreTodo,
  onContinue,
  onPagarConAbono,
  aplicandoAbono,
}: {
  items: ItemCobrable[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  onSelectAll: () => void;
  onClear: () => void;
  totalSeleccionado: number;
  totalPendiente: number;
  propina: number;
  propinaProps: PropinaProps;
  idBono: string | null;
  setIdBono: (v: string | null) => void;
  descuentoBono: number;
  bonoInfo: BonoPreview | null;
  reservasAplicables: ReservaAplicable[];
  idReservaAbono: string | null;
  setIdReservaAbono: (v: string | null) => void;
  descuentoReserva: number;
  reservaCubreTodo: boolean;
  onContinue: () => void;
  onPagarConAbono: () => void;
  aplicandoAbono: boolean;
}) {
  const { grupos, pagados } = useMemo(() => {
    const m = new Map<number, ItemCobrable[]>();
    const pag: ItemCobrable[] = [];
    for (const it of items) {
      if (it.pagado) {
        pag.push(it);
        continue;
      }
      const arr = m.get(it.pedido_numero) ?? [];
      arr.push(it);
      m.set(it.pedido_numero, arr);
    }
    return {
      grupos: Array.from(m.entries()).sort((a, b) => a[0] - b[0]),
      pagados: pag,
    };
  }, [items]);

  const totalPagado = pagados.reduce((a, b) => a + b.subtotal, 0);
  const hayPendientes = grupos.length > 0;
  const subtotalNeto = Math.max(0, totalSeleccionado - descuentoBono - descuentoReserva);
  const totalConPropina = subtotalNeto + (reservaCubreTodo ? 0 : propina);

  return (
    <>
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">
            Pendiente por pagar:{" "}
            <span className="font-semibold text-foreground">
              {fmt.format(totalPendiente)}
            </span>
          </span>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={onSelectAll}
              disabled={!hayPendientes}
            >
              Todo
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={onClear}
              disabled={selected.size === 0}
            >
              <X className="h-3 w-3 mr-1" /> Limpiar
            </Button>
          </div>
        </div>

        {grupos.map(([num, list]) => (
          <div key={num} className="space-y-2">
            <h4 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
              Pedido #{num}
            </h4>
            <ul className="space-y-1">
              {list.map((it) => {
                const isSel = selected.has(it.id_item);
                return (
                  <li
                    key={it.id_item}
                    className={`rounded-lg border p-3 transition-colors ${
                      isSel
                        ? "bg-primary/5 border-primary"
                        : "bg-card hover:bg-muted/40 cursor-pointer"
                    }`}
                    onClick={() => onToggle(it.id_item)}
                  >
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={isSel}
                        className="mt-0.5"
                        onCheckedChange={() => onToggle(it.id_item)}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">
                          {it.cantidad > 1 ? `${it.cantidad}× ` : ""}
                          {it.nombre_producto}
                        </p>
                      </div>
                      <p className="text-sm font-semibold tabular-nums shrink-0">
                        {fmt.format(it.subtotal)}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}

        {!hayPendientes && pagados.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-8">
            No hay items cobrables todavía. Confirma el pedido primero.
          </p>
        )}

        {!hayPendientes && pagados.length > 0 && (
          <div className="rounded-lg border border-dashed bg-muted/30 p-4 text-center text-sm text-muted-foreground">
            <CheckCircle2 className="h-5 w-5 mx-auto mb-1 text-emerald-600" />
            Todos los productos están pagados.
          </div>
        )}

        {pagados.length > 0 && (
          <section className="pt-2 mt-4 border-t space-y-2">
            <div className="flex items-center justify-between text-[11px] uppercase tracking-wider text-muted-foreground">
              <span className="font-semibold">Pagado</span>
              <span className="tabular-nums">{fmt.format(totalPagado)}</span>
            </div>
            <ul className="space-y-1">
              {pagados.map((it) => (
                <li
                  key={it.id_item}
                  className="flex items-center gap-2 px-2 py-1.5 text-xs text-muted-foreground"
                >
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600/70 shrink-0" />
                  <span className="flex-1 truncate line-through">
                    {it.cantidad > 1 ? `${it.cantidad}× ` : ""}
                    {it.nombre_producto}
                  </span>
                  <span className="tabular-nums shrink-0">
                    {fmt.format(it.subtotal)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <div className="border-t bg-card px-5 py-4 space-y-3">
        <div className="space-y-1 text-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span>Subtotal</span>
            <span className="tabular-nums">{fmt.format(totalSeleccionado)}</span>
          </div>
          <BonoRow
            idBono={idBono}
            setIdBono={setIdBono}
            descuento={descuentoBono}
            bonoInfo={bonoInfo}
            disabled={!!idReservaAbono || !hayPendientes}
            onEnsureSelection={onSelectAll}
          />
          <ReservaAbonoRow
            reservas={reservasAplicables}
            idReserva={idReservaAbono}
            setIdReserva={(v) => {
              setIdReservaAbono(v);
              if (v && selected.size === 0) onSelectAll();
            }}
            descuento={descuentoReserva}
            totalSeleccionado={totalSeleccionado}
            disabled={!!idBono || !hayPendientes}
          />
          {!reservaCubreTodo && (
            <PropinaResumenRow propina={propina} propinaProps={propinaProps} />
          )}
          <div className="flex items-baseline justify-between pt-1">
            <span className="text-sm text-muted-foreground">Total a cobrar</span>
            <span className="text-2xl font-bold tabular-nums text-primary">
              {fmt.format(totalConPropina)}
            </span>
          </div>
        </div>
        {reservaCubreTodo ? (
          <Button
            size="lg"
            className="w-full"
            disabled={aplicandoAbono}
            onClick={onPagarConAbono}
          >
            {aplicandoAbono ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <CalendarCheck className="h-4 w-4 mr-2" />
            )}
            Aplicar abono de reserva
          </Button>
        ) : (
          <Button
            size="lg"
            className="w-full"
            disabled={selected.size === 0}
            onClick={onContinue}
          >
            Continuar al método de pago
          </Button>
        )}
      </div>
    </>
  );
}

function ReservaAbonoRow({
  reservas,
  idReserva,
  setIdReserva,
  descuento,
  totalSeleccionado,
  disabled,
}: {
  reservas: ReservaAplicable[];
  idReserva: string | null;
  setIdReserva: (v: string | null) => void;
  descuento: number;
  totalSeleccionado: number;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const sel = reservas.find((r) => r.id_reserva === idReserva) ?? null;
  const cubre = sel && sel.monto_abonado >= totalSeleccionado && totalSeleccionado > 0;
  const visibles = reservas.filter((r) =>
    `${r.codigo_reserva} ${r.customer_name}`
      .toLowerCase()
      .includes(search.trim().toLowerCase()),
  );

  if (!idReserva) {
    return (
      <>
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen(true)}
          className="flex min-h-12 w-full items-center justify-between rounded-lg border bg-background px-3 py-2 text-left transition-colors hover:bg-muted/60 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span className="flex min-w-0 items-center gap-2">
            <CalendarCheck className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0">
              <span className="block text-sm font-medium text-foreground">
                Abono de reserva
              </span>
              <span className="block text-xs text-muted-foreground">
                {disabled ? "No disponible" : "Seleccionar reserva"}
              </span>
            </span>
          </span>
          <span className="shrink-0 text-sm tabular-nums text-muted-foreground">—</span>
        </button>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="top-auto bottom-0 max-h-[88dvh] translate-y-0 rounded-t-2xl p-5 sm:top-[50%] sm:bottom-auto sm:max-w-md sm:translate-y-[-50%] sm:rounded-lg">
            <DialogHeader>
              <DialogTitle>Abono de reserva</DialogTitle>
              <DialogDescription>
                Selecciona una reserva abonada de hoy para descontarla del pago.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 overflow-y-auto">
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar reserva"
                className="h-12"
              />
              <div className="space-y-2">
                {visibles.length === 0 && (
                  <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
                    Sin reservas abonadas hoy
                  </p>
                )}
                {visibles.map((r) => (
                  <button
                    key={r.id_reserva}
                    type="button"
                    onClick={() => {
                      setIdReserva(r.id_reserva);
                      setOpen(false);
                    }}
                    className="flex min-h-16 w-full items-center justify-between gap-3 rounded-lg border bg-card px-3 py-2 text-left transition-colors hover:bg-muted"
                  >
                    <span className="min-w-0">
                      <span className="inline-flex rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                        {r.codigo_reserva}
                      </span>
                      <span className="mt-1 block truncate text-sm font-semibold text-foreground">
                        {r.customer_name}
                      </span>
                    </span>
                    <span className="shrink-0 text-sm font-bold tabular-nums text-primary">
                      -{fmt.format(r.monto_abonado)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <div className="space-y-1 rounded-lg border border-primary/40 bg-primary/5 px-3 py-2">
      <div className="flex min-h-8 items-center justify-between gap-3 text-sm">
        <div className="flex min-w-0 items-center gap-2 text-emerald-700 dark:text-emerald-400">
          <CalendarCheck className="h-4 w-4 shrink-0" />
          <span>
            Abono{sel ? ` · ${sel.codigo_reserva}` : ""}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive"
            onClick={() => setIdReserva(null)}
          >
            Quitar
          </Button>
        </div>
        <span className="tabular-nums font-medium text-emerald-700 dark:text-emerald-400">
          -{fmt.format(descuento)}
        </span>
      </div>
      {sel && !cubre && (
        <p className="text-[11px] text-amber-700 dark:text-amber-400 pl-1">
          El abono cubre {fmt.format(sel.monto_abonado)}. El saldo se cobra con el
          método de pago que elijas.
        </p>
      )}
    </div>
  );
}

function PasoMetodo({
  metodo,
  setMetodo,
  total,
  propina,
  totalConPropina,
  propinaProps,
  descuentoBono,
  descuentoReserva,
  bonoInfo,
  reservaInfo,
  onPagar,
  isLoading,
  onPagarDividido,
  isLoadingDividido,
  reservaCubreTodo,
}: {
  metodo: Metodo;
  setMetodo: (m: Metodo) => void;
  total: number;
  propina: number;
  totalConPropina: number;
  propinaProps: PropinaProps;
  descuentoBono: number;
  descuentoReserva: number;
  bonoInfo: BonoPreview | null;
  reservaInfo: ReservaAplicable | null;
  onPagar: (extras: {
    subtipo?: string;
    voucher?: string;
    urlComprobante?: string;
  }) => void;
  isLoading: boolean;
  onPagarDividido: (
    partes: Array<{
      metodo: Metodo;
      subtipo: string | null;
      voucher: string | null;
      urlComprobante: string | null;
      monto: number;
    }>,
  ) => void;
  isLoadingDividido: boolean;
  reservaCubreTodo: boolean;
}) {
  const [dividir, setDividir] = useState(false);
  const [subtipo, setSubtipo] = useState("");
  const [voucher, setVoucher] = useState("");
  const [recibido, setRecibido] = useState("");
  const [urlComprobante, setUrlComprobante] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const { idNegocio } = useCurrentNegocio();
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setSubtipo("");
    setVoucher("");
    setRecibido("");
    setUrlComprobante(null);
  }, [metodo]);

  const cambio = useMemo(() => {
    const r = Number(recibido);
    if (!Number.isFinite(r) || r <= 0) return null;
    return Math.max(0, r - totalConPropina);
  }, [recibido, totalConPropina]);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!idNegocio) {
      toast.error("No se pudo identificar el negocio");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Máximo 8MB");
      return;
    }
    setSubiendo(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
      const path = `${idNegocio}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage
        .from("comprobantes-pago")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (error) throw error;
      setUrlComprobante(path);
      toast.success("Comprobante subido");
    } catch (err) {
      toast.error("No se pudo subir el comprobante", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setSubiendo(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const puedePagar = (() => {
    if (isLoading) return false;
    if (metodo === "TRANSFERENCIA") return !!urlComprobante && !!subtipo;
    if (metodo === "DATAFONO") return !!subtipo;
    return true;
  })();

  return (
    <>
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
        <div className="rounded-xl bg-primary/5 p-4 space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="tabular-nums font-medium">{fmt.format(total)}</span>
          </div>
          {descuentoBono > 0 && (
            <div className="flex items-center justify-between text-sm text-emerald-700 dark:text-emerald-400">
              <span className="truncate">
                Bono{bonoInfo ? ` · ${bonoInfo.nombre}` : ""}
              </span>
              <span className="shrink-0 tabular-nums font-medium">
                -{fmt.format(descuentoBono)}
              </span>
            </div>
          )}
          {descuentoReserva > 0 && (
            <div className="flex items-center justify-between text-sm text-emerald-700 dark:text-emerald-400">
              <span className="truncate">
                Abono{reservaInfo ? ` · ${reservaInfo.codigo_reserva}` : ""}
              </span>
              <span className="shrink-0 tabular-nums font-medium">
                -{fmt.format(descuentoReserva)}
              </span>
            </div>
          )}
          <PropinaResumenRow propina={propina} propinaProps={propinaProps} />
          <div className="h-px bg-border my-1" />
          <div className="flex items-end justify-between">
            <span className="text-xs uppercase tracking-wider text-muted-foreground">
              Total a cobrar
            </span>
            <span className="text-3xl font-bold tabular-nums text-primary">
              {fmt.format(totalConPropina)}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between rounded-lg border bg-card px-3 py-2">
          <div className="min-w-0 pr-3">
            <p className="text-sm font-medium">Dividir pago</p>
            <p className="text-[11px] text-muted-foreground">
              Cobra el total en varias partes con métodos distintos.
            </p>
          </div>
          <Switch
            checked={dividir}
            disabled={reservaCubreTodo}
            onCheckedChange={(v) => setDividir(!!v)}
          />
        </div>

        {!dividir && (
          <>
            <div className="grid grid-cols-3 gap-2">
              <MetodoBtn
                active={metodo === "EFECTIVO"}
                onClick={() => setMetodo("EFECTIVO")}
                icon={<Banknote className="h-5 w-5" />}
                label="Efectivo"
              />
              <MetodoBtn
                active={metodo === "TRANSFERENCIA"}
                onClick={() => setMetodo("TRANSFERENCIA")}
                icon={<Smartphone className="h-5 w-5" />}
                label="Transferencia"
              />
              <MetodoBtn
                active={metodo === "DATAFONO"}
                onClick={() => setMetodo("DATAFONO")}
                icon={<CreditCard className="h-5 w-5" />}
                label="Datáfono"
              />
            </div>

            {metodo === "EFECTIVO" && (
              <div className="space-y-3">
                <div>
                  <Label htmlFor="recibido">Monto recibido (opcional)</Label>
                  <Input
                    id="recibido"
                    inputMode="numeric"
                    value={recibido}
                    onChange={(e) =>
                      setRecibido(e.target.value.replace(/[^\d]/g, ""))
                    }
                    placeholder="0"
                  />
                </div>
                {cambio !== null && (
                  <div className="rounded-lg bg-muted p-3 flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Cambio</span>
                    <span className="text-lg font-bold tabular-nums">
                      {fmt.format(cambio)}
                    </span>
                  </div>
                )}
              </div>
            )}

            {metodo === "TRANSFERENCIA" && (
              <TransferenciaSection
                subtipo={subtipo}
                setSubtipo={setSubtipo}
                urlComprobante={urlComprobante}
                subiendo={subiendo}
                fileRef={fileRef}
                handleFile={handleFile}
              />
            )}

            {metodo === "DATAFONO" && (
              <div className="space-y-3">
                <div>
                  <Label>Tipo</Label>
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    {["Débito", "Crédito"].map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setSubtipo(s)}
                        className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
                          subtipo === s
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-card hover:bg-muted"
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <Label htmlFor="voucher">N° voucher (opcional)</Label>
                  <Input
                    id="voucher"
                    value={voucher}
                    onChange={(e) => setVoucher(e.target.value.slice(0, 50))}
                    placeholder="Ej: 123456"
                  />
                </div>
              </div>
            )}
          </>
        )}

        {dividir && (
          <PartesEditor
            totalRequerido={totalConPropina}
            onSubmit={onPagarDividido}
            isLoading={isLoadingDividido}
          />
        )}
      </div>

      {!dividir && (
        <div className="border-t bg-card px-5 py-4">
          <Button
            size="lg"
            className="w-full"
            disabled={!puedePagar}
            onClick={() =>
              onPagar({
                subtipo: subtipo || undefined,
                voucher: voucher || undefined,
                urlComprobante: urlComprobante ?? undefined,
              })
            }
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <CheckCircle2 className="h-4 w-4 mr-2" />
            )}
            Confirmar pago de {fmt.format(totalConPropina)}
          </Button>
        </div>
      )}
    </>
  );
}

function MetodoBtn({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center gap-1.5 rounded-xl border-2 px-2 py-3 transition-colors ${
        active
          ? "border-primary bg-primary/5 text-primary"
          : "border-border bg-card hover:bg-muted text-muted-foreground"
      }`}
    >
      {icon}
      <span className="text-xs font-medium">{label}</span>
    </button>
  );
}

function TransferenciaSection({
  subtipo,
  setSubtipo,
  urlComprobante,
  subiendo,
  fileRef,
  handleFile,
}: {
  subtipo: string;
  setSubtipo: (s: string) => void;
  urlComprobante: string | null;
  subiendo: boolean;
  fileRef: React.MutableRefObject<HTMLInputElement | null>;
  handleFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  const listar = useServerFn(listarMetodosPagoQr);
  const qrQ = useQuery({
    queryKey: ["metodosPagoQr"],
    queryFn: () => listar(),
  });
  const qrs = qrQ.data ?? [];
  const [qrOpen, setQrOpen] = useState<MetodoPagoQr | null>(null);

  const plataformasFijas: Array<"Nequi" | "Daviplata" | "Bancolombia"> = [
    "Nequi",
    "Daviplata",
    "Bancolombia",
  ];
  const otras = qrs.filter((q) => q.plataforma === "Otra");

  const handleClick = (label: string, registro: MetodoPagoQr | null) => {
    setSubtipo(label);
    if (registro?.signed_url) setQrOpen(registro);
  };

  return (
    <div className="space-y-3">
      <div>
        <Label>Plataforma</Label>
        <div className="grid grid-cols-2 gap-2 mt-1">
          {plataformasFijas.map((s) => {
            const r = qrs.find((q) => q.plataforma === s) ?? null;
            return (
              <PlataformaBtn
                key={s}
                label={s}
                active={subtipo === s}
                hasQr={!!r?.signed_url}
                onClick={() => handleClick(s, r)}
              />
            );
          })}
          {otras.map((r) => {
            const label = r.etiqueta || "Otra";
            return (
              <PlataformaBtn
                key={r.id_qr}
                label={label}
                active={subtipo === label}
                hasQr={!!r.signed_url}
                onClick={() => handleClick(label, r)}
              />
            );
          })}
          {otras.length === 0 && (
            <PlataformaBtn
              label="Otra"
              active={subtipo === "Otra"}
              hasQr={false}
              onClick={() => handleClick("Otra", null)}
            />
          )}
        </div>
        {subtipo &&
          !qrs.find(
            (q) =>
              q.plataforma === subtipo ||
              (q.plataforma === "Otra" && q.etiqueta === subtipo),
          )?.signed_url && (
            <p className="text-[11px] text-muted-foreground mt-1.5">
              Sin QR configurado. Pídele al admin que lo cargue en Configuración
              → Métodos de pago.
            </p>
          )}
      </div>
      <div>
        <Label>Comprobante</Label>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFile}
        />
        <Button
          type="button"
          variant={urlComprobante ? "secondary" : "outline"}
          className="w-full mt-1"
          onClick={() => fileRef.current?.click()}
          disabled={subiendo}
        >
          {subiendo ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Camera className="h-4 w-4 mr-2" />
          )}
          {urlComprobante
            ? "Comprobante subido — cambiar"
            : "Tomar / subir foto"}
        </Button>
        <p className="text-[11px] text-muted-foreground mt-1">
          Se enviará al administrador para que confirme la recepción.
        </p>
      </div>

      <Dialog open={!!qrOpen} onOpenChange={(o) => !o && setQrOpen(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              Escanea con {qrOpen?.etiqueta || qrOpen?.plataforma}
            </DialogTitle>
          </DialogHeader>
          {qrOpen?.titular && (
            <p className="text-sm text-muted-foreground -mt-2">
              {qrOpen.titular}
            </p>
          )}
          {qrOpen?.signed_url && (
            <div className="rounded-xl bg-white p-4 flex items-center justify-center">
              <img
                src={qrOpen.signed_url}
                alt={`QR ${qrOpen.plataforma}`}
                className="w-full max-w-sm aspect-square object-contain"
              />
            </div>
          )}
          <Button onClick={() => setQrOpen(null)} className="w-full">
            Cerrar
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PlataformaBtn({
  label,
  active,
  hasQr,
  onClick,
}: {
  label: string;
  active: boolean;
  hasQr: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative rounded-lg border px-3 py-2 text-sm transition-colors ${
        active
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-card hover:bg-muted"
      }`}
    >
      {label}
      {hasQr && (
        <span
          className={`ml-1.5 inline-flex items-center align-middle ${
            active ? "opacity-90" : "text-muted-foreground"
          }`}
          title="QR disponible"
        >
          <QrCodeIcon className="h-3.5 w-3.5" />
        </span>
      )}
    </button>
  );
}

type ParteState = {
  key: string;
  metodo: Metodo;
  subtipo: string;
  voucher: string;
  urlComprobante: string | null;
  monto: string; // string para input controlado
};

function nuevaParte(monto = ""): ParteState {
  return {
    key: Math.random().toString(36).slice(2, 9),
    metodo: "EFECTIVO",
    subtipo: "",
    voucher: "",
    urlComprobante: null,
    monto,
  };
}

function PartesEditor({
  totalRequerido,
  onSubmit,
  isLoading,
}: {
  totalRequerido: number;
  onSubmit: (
    partes: Array<{
      metodo: Metodo;
      subtipo: string | null;
      voucher: string | null;
      urlComprobante: string | null;
      monto: number;
    }>,
  ) => void;
  isLoading: boolean;
}) {
  const [partes, setPartes] = useState<ParteState[]>(() => [
    nuevaParte(String(Math.floor(totalRequerido / 2))),
    nuevaParte(String(totalRequerido - Math.floor(totalRequerido / 2))),
  ]);
  const { idNegocio } = useCurrentNegocio();

  const updateParte = (key: string, patch: Partial<ParteState>) =>
    setPartes((ps) => ps.map((p) => (p.key === key ? { ...p, ...patch } : p)));
  const removeParte = (key: string) =>
    setPartes((ps) => (ps.length <= 2 ? ps : ps.filter((p) => p.key !== key)));
  const addParte = () =>
    setPartes((ps) => (ps.length >= 10 ? ps : [...ps, nuevaParte()]));

  const sumaPartes = useMemo(
    () => partes.reduce((a, b) => a + (Number(b.monto) || 0), 0),
    [partes],
  );
  const saldo = totalRequerido - sumaPartes;

  const autocompletarSaldo = () => {
    if (partes.length === 0) return;
    const ultima = partes[partes.length - 1];
    const nuevoMonto = Math.max(0, (Number(ultima.monto) || 0) + saldo);
    updateParte(ultima.key, { monto: String(nuevoMonto) });
  };

  const parteValida = (p: ParteState) => {
    const n = Number(p.monto);
    if (!Number.isFinite(n) || n <= 0) return false;
    if (p.metodo === "TRANSFERENCIA") return !!p.subtipo && !!p.urlComprobante;
    if (p.metodo === "DATAFONO") return !!p.subtipo;
    return true;
  };
  const todasValidas = partes.every(parteValida);
  const cuadra = Math.abs(saldo) <= 1;
  const puedePagar =
    !isLoading && partes.length >= 2 && todasValidas && cuadra;

  const handleSubmit = () => {
    if (!puedePagar) return;
    onSubmit(
      partes.map((p) => ({
        metodo: p.metodo,
        subtipo: p.subtipo || null,
        voucher: p.voucher || null,
        urlComprobante: p.urlComprobante,
        monto: Math.max(1, Math.floor(Number(p.monto) || 0)),
      })),
    );
  };

  return (
    <div className="space-y-3">
      {partes.map((p, i) => (
        <ParteCard
          key={p.key}
          index={i}
          parte={p}
          onChange={(patch) => updateParte(p.key, patch)}
          onRemove={partes.length > 2 ? () => removeParte(p.key) : null}
          idNegocio={idNegocio ?? null}
        />
      ))}

      <div className="flex items-center justify-between gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addParte}
          disabled={partes.length >= 10}
        >
          + Agregar parte
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={autocompletarSaldo}
          disabled={saldo === 0}
        >
          Autocompletar saldo
        </Button>
      </div>

      <div className="rounded-lg border bg-muted/40 p-3 text-sm space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Total requerido</span>
          <span className="tabular-nums font-medium">
            {fmt.format(totalRequerido)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Suma de partes</span>
          <span className="tabular-nums font-medium">
            {fmt.format(sumaPartes)}
          </span>
        </div>
        <div
          className={`flex items-center justify-between font-semibold ${
            cuadra
              ? "text-emerald-700 dark:text-emerald-400"
              : "text-red-600 dark:text-red-400"
          }`}
        >
          <span>Saldo por asignar</span>
          <span className="tabular-nums">{fmt.format(Math.abs(saldo))}</span>
        </div>
      </div>

      <Button
        size="lg"
        className="w-full"
        disabled={!puedePagar}
        onClick={handleSubmit}
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
        ) : (
          <CheckCircle2 className="h-4 w-4 mr-2" />
        )}
        Confirmar pago dividido de {fmt.format(totalRequerido)}
      </Button>
    </div>
  );
}

function ParteCard({
  index,
  parte,
  onChange,
  onRemove,
  idNegocio,
}: {
  index: number;
  parte: ParteState;
  onChange: (patch: Partial<ParteState>) => void;
  onRemove: (() => void) | null;
  idNegocio: string | null;
}) {
  const [subiendo, setSubiendo] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!idNegocio) {
      toast.error("No se pudo identificar el negocio");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Máximo 8MB");
      return;
    }
    setSubiendo(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
      const path = `${idNegocio}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage
        .from("comprobantes-pago")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (error) throw error;
      onChange({ urlComprobante: path });
      toast.success("Comprobante subido");
    } catch (err) {
      toast.error("No se pudo subir el comprobante", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setSubiendo(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="rounded-xl border bg-card p-3 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Parte {index + 1}</p>
        {onRemove && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onRemove}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2">
        <MetodoBtn
          active={parte.metodo === "EFECTIVO"}
          onClick={() =>
            onChange({
              metodo: "EFECTIVO",
              subtipo: "",
              urlComprobante: null,
              voucher: "",
            })
          }
          icon={<Banknote className="h-4 w-4" />}
          label="Efectivo"
        />
        <MetodoBtn
          active={parte.metodo === "TRANSFERENCIA"}
          onClick={() =>
            onChange({
              metodo: "TRANSFERENCIA",
              subtipo: "",
              urlComprobante: null,
              voucher: "",
            })
          }
          icon={<Smartphone className="h-4 w-4" />}
          label="Transf."
        />
        <MetodoBtn
          active={parte.metodo === "DATAFONO"}
          onClick={() =>
            onChange({
              metodo: "DATAFONO",
              subtipo: "",
              urlComprobante: null,
              voucher: "",
            })
          }
          icon={<CreditCard className="h-4 w-4" />}
          label="Datáfono"
        />
      </div>

      <div>
        <Label>Monto</Label>
        <Input
          inputMode="numeric"
          value={parte.monto}
          onChange={(e) =>
            onChange({ monto: e.target.value.replace(/[^\d]/g, "") })
          }
          placeholder="0"
          className="h-11 text-base"
        />
      </div>

      {parte.metodo === "TRANSFERENCIA" && (
        <TransferenciaSection
          subtipo={parte.subtipo}
          setSubtipo={(s) => onChange({ subtipo: s })}
          urlComprobante={parte.urlComprobante}
          subiendo={subiendo}
          fileRef={fileRef}
          handleFile={handleFile}
        />
      )}

      {parte.metodo === "DATAFONO" && (
        <div className="space-y-2">
          <Label>Tipo</Label>
          <div className="grid grid-cols-2 gap-2">
            {["Débito", "Crédito"].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => onChange({ subtipo: s })}
                className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
                  parte.subtipo === s
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card hover:bg-muted"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
          <Input
            value={parte.voucher}
            onChange={(e) =>
              onChange({ voucher: e.target.value.slice(0, 50) })
            }
            placeholder="N° voucher (opcional)"
          />
        </div>
      )}
    </div>
  );
}
