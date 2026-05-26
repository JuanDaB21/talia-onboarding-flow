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
  HandCoins,
  Loader2,
  Smartphone,
  X,
} from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentNegocio } from "@/hooks/use-current-negocio";
import {
  listarItemsCobrables,
  registrarPago,
  type ItemCobrable,
} from "@/lib/pagos.functions";
import { useNavigate } from "@tanstack/react-router";

const fmt = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

type Metodo = "EFECTIVO" | "TRANSFERENCIA" | "DATAFONO";
type Paso = "propina" | "items" | "metodo";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  idMesa: string;
}

export function PagarSheet({ open, onOpenChange, idMesa }: Props) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const getItems = useServerFn(listarItemsCobrables);
  const pagarFn = useServerFn(registrarPago);

  const itemsQ = useQuery({
    queryKey: ["pagos", "items", idMesa],
    queryFn: () => getItems({ data: { idMesa } }),
    enabled: open,
  });

  const [paso, setPaso] = useState<Paso>("propina");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [metodo, setMetodo] = useState<Metodo>("EFECTIVO");
  // Propina decidida por el cliente al inicio del cobro.
  // Si elige porcentaje guardamos el pct y se aplica al total seleccionado.
  // Si escribe monto personalizado, guardamos el valor absoluto.
  const [propinaPct, setPropinaPct] = useState<number | null>(0.1);
  const [propinaCustom, setPropinaCustom] = useState<number | null>(null);

  // Reset al abrir
  useEffect(() => {
    if (open) {
      setPaso("propina");
      setSelected(new Set());
      setMetodo("EFECTIVO");
      setPropinaPct(0.1);
      setPropinaCustom(null);
    }
  }, [open]);

  const items = itemsQ.data?.items ?? [];
  const pendientes = items.filter((i) => !i.pagado);
  const totalSeleccionado = useMemo(
    () => items.filter((i) => selected.has(i.id_item)).reduce((a, b) => a + b.subtotal, 0),
    [items, selected],
  );
  const propina =
    propinaCustom !== null
      ? Math.max(0, Math.floor(propinaCustom))
      : Math.round(totalSeleccionado * (propinaPct ?? 0));
  const totalConPropina = totalSeleccionado + propina;

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
  };
  const pagarMut = useMutation({
    mutationFn: (input: PagarInput) => pagarFn({ data: input }),
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

      itemsQ.refetch().then((r) => {
        const restantes = r.data?.items.filter((i) => !i.pagado) ?? [];
        if (restantes.length === 0 && !esTransfer) {
          onOpenChange(false);
          navigate({ to: "/servicio" });
        } else {
          setPaso("propina");
          setSelected(new Set());
          setPropinaPct(0.1);
          setPropinaCustom(null);
        }
      });
    },
    onError: (e) =>
      toast.error("No se pudo registrar el pago", {
        description: e instanceof Error ? e.message : undefined,
      }),
  });

  const tituloPaso =
    paso === "propina"
      ? "Propina"
      : paso === "items"
        ? "Selecciona los productos a cobrar"
        : "Método de pago";

  const backTo: Paso | null =
    paso === "items" ? "propina" : paso === "metodo" ? "items" : null;

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
        ) : paso === "propina" ? (
          <PasoPropina
            propinaPct={propinaPct}
            propinaCustom={propinaCustom}
            onPickPct={(pct) => {
              setPropinaPct(pct);
              setPropinaCustom(null);
            }}
            onCustom={(val) => {
              setPropinaCustom(val);
              setPropinaPct(null);
            }}
            onContinue={() => setPaso("items")}
          />
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
            onContinue={() => setPaso("metodo")}
          />
        ) : (
          <PasoMetodo
            metodo={metodo}
            setMetodo={setMetodo}
            total={totalSeleccionado}
            propina={propina}
            totalConPropina={totalConPropina}
            onEditarPropina={() => setPaso("propina")}
            onPagar={(extras) =>
              pagarMut.mutate({
                idMesa,
                metodo,
                subtipo: extras.subtipo ?? null,
                voucher: extras.voucher ?? null,
                urlComprobante: extras.urlComprobante ?? null,
                itemIds: Array.from(selected),
                propina,
              })
            }
            isLoading={pagarMut.isPending}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

function PasoPropina({
  propinaPct,
  propinaCustom,
  onPickPct,
  onCustom,
  onContinue,
}: {
  propinaPct: number | null;
  propinaCustom: number | null;
  onPickPct: (pct: number) => void;
  onCustom: (val: number | null) => void;
  onContinue: () => void;
}) {
  const [customStr, setCustomStr] = useState<string>(
    propinaCustom !== null ? String(propinaCustom) : "",
  );

  const opciones: { pct: number; label: string }[] = [
    { pct: 0, label: "Sin propina" },
    { pct: 0.05, label: "5%" },
    { pct: 0.1, label: "10%" },
    { pct: 0.15, label: "15%" },
  ];

  return (
    <>
      <div className="flex-1 overflow-y-auto px-5 py-6 space-y-6">
        <div className="rounded-2xl bg-primary/5 border border-primary/20 p-5 text-center space-y-2">
          <HandCoins className="h-10 w-10 mx-auto text-primary" />
          <h3 className="text-xl font-bold">Pregúntale al cliente</h3>
          <p className="text-sm text-muted-foreground">
            ¿Desea dejar propina? Muéstrale el celular para que elija.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {opciones.map((o) => {
            const active = propinaCustom === null && propinaPct === o.pct;
            return (
              <button
                key={o.pct}
                type="button"
                onClick={() => {
                  onPickPct(o.pct);
                  setCustomStr("");
                }}
                className={`rounded-xl border-2 px-3 py-6 text-center transition-colors ${
                  active
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-card hover:bg-muted"
                }`}
              >
                <div className="text-2xl font-bold">{o.label}</div>
                {o.pct > 0 && (
                  <div className="text-[11px] text-muted-foreground mt-1">
                    sobre el total
                  </div>
                )}
              </button>
            );
          })}
        </div>

        <div className="rounded-xl border p-4 space-y-2">
          <Label htmlFor="propina-custom" className="text-sm">
            O un monto fijo (opcional)
          </Label>
          <Input
            id="propina-custom"
            inputMode="numeric"
            placeholder="Ej: 5000"
            value={customStr}
            onChange={(e) => {
              const v = e.target.value.replace(/[^\d]/g, "");
              setCustomStr(v);
              onCustom(v === "" ? null : Number(v));
            }}
            className={propinaCustom !== null ? "border-primary" : ""}
          />
          <p className="text-[11px] text-muted-foreground">
            Si escribes un monto se usa este valor en vez del porcentaje.
          </p>
        </div>
      </div>

      <div className="border-t bg-card px-5 py-4">
        <Button size="lg" className="w-full" onClick={onContinue}>
          Continuar
        </Button>
      </div>
    </>
  );
}

function PasoItems({
  items,
  selected,
  onToggle,
  onSelectAll,
  onClear,
  totalSeleccionado,
  totalPendiente,
  propina,
  onContinue,
}: {
  items: ItemCobrable[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  onSelectAll: () => void;
  onClear: () => void;
  totalSeleccionado: number;
  totalPendiente: number;
  propina: number;
  onContinue: () => void;
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
  const totalConPropina = totalSeleccionado + propina;

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
          <div className="flex items-center justify-between text-muted-foreground">
            <span>Propina</span>
            <span className="tabular-nums">{fmt.format(propina)}</span>
          </div>
          <div className="flex items-baseline justify-between pt-1">
            <span className="text-sm text-muted-foreground">Total a cobrar</span>
            <span className="text-2xl font-bold tabular-nums text-primary">
              {fmt.format(totalConPropina)}
            </span>
          </div>
        </div>
        <Button
          size="lg"
          className="w-full"
          disabled={selected.size === 0}
          onClick={onContinue}
        >
          Continuar al método de pago
        </Button>
      </div>
    </>
  );
}

function PasoMetodo({
  metodo,
  setMetodo,
  total,
  propina,
  totalConPropina,
  onEditarPropina,
  onPagar,
  isLoading,
}: {
  metodo: Metodo;
  setMetodo: (m: Metodo) => void;
  total: number;
  propina: number;
  totalConPropina: number;
  onEditarPropina: () => void;
  onPagar: (extras: {
    subtipo?: string;
    voucher?: string;
    urlComprobante?: string;
  }) => void;
  isLoading: boolean;
}) {
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
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              Propina
              <button
                type="button"
                onClick={onEditarPropina}
                className="ml-2 text-xs underline text-primary hover:opacity-80"
              >
                editar
              </button>
            </span>
            <span className="tabular-nums font-medium">{fmt.format(propina)}</span>
          </div>
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
                onChange={(e) => setRecibido(e.target.value.replace(/[^\d]/g, ""))}
                placeholder="0"
              />
            </div>
            {cambio !== null && (
              <div className="rounded-lg bg-muted p-3 flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Cambio</span>
                <span className="text-lg font-bold tabular-nums">{fmt.format(cambio)}</span>
              </div>
            )}
          </div>
        )}

        {metodo === "TRANSFERENCIA" && (
          <div className="space-y-3">
            <div>
              <Label>Plataforma</Label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                {["Nequi", "Daviplata", "Bancolombia", "Otra"].map((s) => (
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
                {urlComprobante ? "Comprobante subido — cambiar" : "Tomar / subir foto"}
              </Button>
              <p className="text-[11px] text-muted-foreground mt-1">
                Se enviará al administrador para que confirme la recepción.
              </p>
            </div>
          </div>
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
      </div>

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
