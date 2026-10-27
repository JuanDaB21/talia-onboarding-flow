import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Banknote,
  Bike,
  CheckCircle2,
  CreditCard,
  ExternalLink,
  Landmark,
  Loader2,
  MapPin,
  Phone,
  ShoppingBag,
  Upload,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/format";
import { uploadToStorage, usePrivImage } from "@/lib/storage";
import { enlaceWhatsApp } from "@/lib/whatsapp";
import { confirmarPago } from "@/lib/pagos.functions";
import { listarMetodosPago } from "@/lib/metodos-pago.functions";
import { cancelarDomicilio, cobrarDomicilio, type Domicilio } from "@/lib/domicilios.functions";
import { WhatsAppIcon } from "@/components/menu-publico/pedido/iconos-marca";
import { agruparItems, estadoCobro, METODO_LABEL } from "./domicilio-utils";

const ESTADO_LABEL: Record<Domicilio["estado"], string> = {
  PENDIENTE: "Sin confirmar",
  EN_PREPARACION: "En preparación",
  LISTO: "Listo",
  EN_CAMINO: "En camino",
  ENTREGADO: "Entregado",
  CANCELADO: "Cancelado",
};

function errorMsg(e: unknown) {
  return e instanceof Error ? e.message : undefined;
}

export function DomicilioSheet({
  d,
  open,
  onOpenChange,
  negocioNombre,
  acciones,
}: {
  d: Domicilio | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  negocioNombre: string;
  /** Acción principal del estado actual (confirmar / despachar / entregar), la misma de la tarjeta. */
  acciones: Array<{
    label: string;
    onClick: () => void;
    pending?: boolean;
    variant?: "default" | "outline";
  }>;
}) {
  const qc = useQueryClient();
  const [cobrando, setCobrando] = useState(false);
  const [cancelando, setCancelando] = useState(false);
  const comprobante = usePrivImage(d?.url_comprobante ?? null);

  useEffect(() => {
    setCobrando(false);
    setCancelando(false);
  }, [d?.id_domicilio]);

  const invalidar = () => qc.invalidateQueries({ queryKey: ["domicilios", "tablero"] });

  const verificar = useMutation({
    mutationFn: (aprobar: boolean) => confirmarPago(d!.id_pago_pendiente!, aprobar),
    onSuccess: (_r, aprobar) => {
      toast.success(aprobar ? "Transferencia aprobada" : "Transferencia rechazada");
      void invalidar();
    },
    onError: (e) => toast.error("No se pudo actualizar el pago", { description: errorMsg(e) }),
  });

  if (!d) return null;
  const cobro = estadoCobro(d);
  const grupos = agruparItems(d);
  const puedeCobrar =
    !d.pagado && !d.id_pago_pendiente && !["PENDIENTE", "CANCELADO"].includes(d.estado);
  const cerrado = d.estado === "ENTREGADO" || d.estado === "CANCELADO";
  const waCliente = enlaceWhatsApp(
    d.cliente_telefono,
    `Hola ${d.cliente_nombre}, te escribimos de ${negocioNombre} sobre tu pedido ${d.codigo}.`,
  );
  const maps = d.direccion
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        [d.direccion, d.municipio_nombre].filter(Boolean).join(", "),
      )}`
    : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-md">
        <SheetHeader className="space-y-1 border-b p-5 text-left">
          <div className="flex items-center gap-2">
            {d.tipo === "DOMICILIO" ? (
              <Bike className="h-5 w-5 text-primary" />
            ) : (
              <ShoppingBag className="h-5 w-5 text-primary" />
            )}
            <SheetTitle className="font-mono text-xl">{d.codigo}</SheetTitle>
            <Badge variant={d.estado === "CANCELADO" ? "destructive" : "secondary"}>
              {ESTADO_LABEL[d.estado]}
            </Badge>
          </div>
          <SheetDescription>
            {d.tipo === "DOMICILIO" ? "Domicilio" : "Para recoger"} · recibido{" "}
            {new Date(d.created_at).toLocaleTimeString("es-CO", {
              hour: "numeric",
              minute: "2-digit",
            })}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-5 p-5">
          <section className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Cliente
            </h3>
            <p className="font-medium">{d.cliente_nombre}</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" className="gap-1.5" asChild>
                <a href={`tel:${d.cliente_telefono}`}>
                  <Phone className="h-3.5 w-3.5" /> {d.cliente_telefono}
                </a>
              </Button>
              {waCliente && (
                <Button variant="outline" size="sm" className="gap-1.5" asChild>
                  <a href={waCliente} target="_blank" rel="noreferrer">
                    <WhatsAppIcon className="h-3.5 w-3.5" /> WhatsApp
                  </a>
                </Button>
              )}
            </div>
            {d.tipo === "DOMICILIO" && (
              <div className="rounded-lg border p-3 text-sm">
                <p className="flex items-start gap-1.5">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <span>
                    {d.direccion}
                    {d.referencia && (
                      <span className="block text-muted-foreground">{d.referencia}</span>
                    )}
                    {d.municipio_nombre && (
                      <span className="block text-muted-foreground">{d.municipio_nombre}</span>
                    )}
                  </span>
                </p>
                {maps && (
                  <a
                    href={maps}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary"
                  >
                    <ExternalLink className="h-3 w-3" /> Abrir en Maps
                  </a>
                )}
              </div>
            )}
            {d.notas && (
              <p className="rounded-lg bg-muted/60 p-3 text-sm">
                <span className="font-medium">Nota: </span>
                {d.notas}
              </p>
            )}
            {d.motivo_cancelacion && (
              <p className="text-sm text-destructive">Motivo: {d.motivo_cancelacion}</p>
            )}
          </section>

          <Separator />

          <section className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Pedido
            </h3>
            <ul className="space-y-2 text-sm">
              {grupos.map((g) => (
                <li key={`${g.nombre}|${g.detalle}`} className="flex justify-between gap-3">
                  <span className="min-w-0">
                    <span className="font-semibold tabular-nums">{g.cantidad}×</span> {g.nombre}
                    {g.detalle && (
                      <span className="block text-xs text-muted-foreground">{g.detalle}</span>
                    )}
                    {d.estado === "EN_PREPARACION" && (
                      <span className="block text-[11px] text-muted-foreground">
                        {g.listos}/{g.cantidad} listos
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 tabular-nums">{formatMoney(g.subtotal)}</span>
                </li>
              ))}
            </ul>
            <dl className="space-y-1 border-t pt-2 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <dt>Productos</dt>
                <dd className="tabular-nums">{formatMoney(d.subtotal)}</dd>
              </div>
              {d.tipo === "DOMICILIO" && (
                <div className="flex justify-between text-muted-foreground">
                  <dt>Envío</dt>
                  <dd className="tabular-nums">{formatMoney(d.costo_envio)}</dd>
                </div>
              )}
              <div className="flex justify-between text-base font-bold">
                <dt>Total</dt>
                <dd className="tabular-nums">{formatMoney(d.total)}</dd>
              </div>
            </dl>
          </section>

          <Separator />

          <section className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Pago
            </h3>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Badge variant="secondary">{METODO_LABEL[d.metodo_pago]}</Badge>
              {d.metodo_pago_nombre && (
                <span className="text-muted-foreground">{d.metodo_pago_nombre}</span>
              )}
              {cobro === "pagado" && (
                <Badge className="gap-1 bg-emerald-600 hover:bg-emerald-600">
                  <CheckCircle2 className="h-3 w-3" /> Pagado
                </Badge>
              )}
            </div>
            {d.metodo_pago === "EFECTIVO" && d.paga_con ? (
              <p className="text-sm">
                Paga con <strong>{formatMoney(d.paga_con)}</strong> · llevar cambio de{" "}
                <strong>{formatMoney(Math.max(0, d.paga_con - d.total))}</strong>
              </p>
            ) : null}
            {comprobante && (
              <a href={comprobante} target="_blank" rel="noreferrer" className="block">
                <img
                  src={comprobante}
                  alt="Comprobante del cliente"
                  className="max-h-64 w-full rounded-lg border bg-muted object-contain"
                />
              </a>
            )}
            {d.id_pago_pendiente && (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="flex-1 gap-1.5"
                  onClick={() => verificar.mutate(true)}
                  disabled={verificar.isPending}
                >
                  <CheckCircle2 className="h-4 w-4" /> Aprobar transferencia
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => verificar.mutate(false)}
                  disabled={verificar.isPending}
                >
                  <XCircle className="h-4 w-4" /> Rechazar
                </Button>
              </div>
            )}
            {puedeCobrar && !cobrando && (
              <Button
                variant="outline"
                className="w-full gap-1.5"
                onClick={() => setCobrando(true)}
              >
                <Banknote className="h-4 w-4" /> Confirmar pago
              </Button>
            )}
            {puedeCobrar && cobrando && (
              <CobroPanel
                d={d}
                onCancel={() => setCobrando(false)}
                onDone={() => setCobrando(false)}
              />
            )}
            {d.estado === "PENDIENTE" && !d.pagado && (
              <p className="text-xs text-muted-foreground">
                Confirma el pedido para poder registrar el pago.
              </p>
            )}
          </section>

          {cancelando && <CancelarPanel d={d} onClose={() => setCancelando(false)} />}
        </div>

        {!cerrado && (
          <div className="sticky bottom-0 space-y-2 border-t bg-background p-4">
            {acciones.map((a) => (
              <Button
                key={a.label}
                className="h-11 w-full"
                variant={a.variant ?? "default"}
                onClick={a.onClick}
                disabled={a.pending}
              >
                {a.pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {a.label}
              </Button>
            ))}
            {!cancelando && !d.pagado && (
              <Button
                variant="ghost"
                className="w-full text-destructive hover:text-destructive"
                onClick={() => setCancelando(true)}
              >
                Cancelar pedido
              </Button>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

type MetodoCobro = "EFECTIVO" | "TRANSFERENCIA" | "DATAFONO";

function CobroPanel({
  d,
  onCancel,
  onDone,
}: {
  d: Domicilio;
  onCancel: () => void;
  onDone: () => void;
}) {
  const qc = useQueryClient();
  const [metodo, setMetodo] = useState<MetodoCobro>(
    d.metodo_pago === "TRANSFERENCIA" ? "TRANSFERENCIA" : "EFECTIVO",
  );
  const [subtipo, setSubtipo] = useState<string>(d.metodo_pago_nombre ?? "");
  const [url, setUrl] = useState<string | null>(d.url_comprobante);
  const [aprobar, setAprobar] = useState(true);
  const [recibido, setRecibido] = useState(d.paga_con ? String(d.paga_con) : "");
  const [propina, setPropina] = useState("");
  const [subiendo, setSubiendo] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const { data: metodos = [] } = useQuery({
    queryKey: ["metodosPago"],
    queryFn: () => listarMetodosPago(),
    enabled: metodo === "TRANSFERENCIA",
  });

  const propinaNum = Number(propina || 0);
  const total = d.total + propinaNum;
  const recibidoNum = Number(recibido || 0);

  const mut = useMutation({
    mutationFn: () =>
      cobrarDomicilio({
        idDomicilio: d.id_domicilio,
        metodo,
        subtipo: metodo === "TRANSFERENCIA" ? subtipo || null : null,
        urlComprobante: metodo === "TRANSFERENCIA" ? url : null,
        propina: propinaNum,
        aprobarTransferencia: metodo === "TRANSFERENCIA" && aprobar,
        montoRecibido: metodo === "EFECTIVO" && recibidoNum > 0 ? recibidoNum : null,
      }),
    onSuccess: () => {
      toast.success(`Pago de ${d.codigo} registrado`);
      void qc.invalidateQueries({ queryKey: ["domicilios", "tablero"] });
      void qc.invalidateQueries({ queryKey: ["caja"] });
      void qc.invalidateQueries({ queryKey: ["pagos"] });
      onDone();
    },
    onError: (e) => toast.error("No se pudo registrar el pago", { description: errorMsg(e) }),
  });

  async function subir(f: File) {
    setSubiendo(true);
    try {
      const { path } = await uploadToStorage("comprobante", f);
      setUrl(path);
    } catch (e) {
      toast.error("No se pudo subir", { description: errorMsg(e) });
    } finally {
      setSubiendo(false);
    }
  }

  const valido =
    propinaNum >= 0 &&
    (metodo !== "TRANSFERENCIA" || !!url) &&
    (metodo !== "EFECTIVO" || recibido === "" || recibidoNum >= total);

  const opciones: Array<{ v: MetodoCobro; label: string; icon: React.ReactNode }> = [
    { v: "EFECTIVO", label: "Efectivo", icon: <Banknote className="h-4 w-4" /> },
    { v: "TRANSFERENCIA", label: "Transferencia", icon: <Landmark className="h-4 w-4" /> },
    { v: "DATAFONO", label: "Datáfono", icon: <CreditCard className="h-4 w-4" /> },
  ];

  return (
    <div className="space-y-3 rounded-xl border p-3">
      <div className="grid grid-cols-3 gap-1.5">
        {opciones.map((o) => (
          <button
            key={o.v}
            type="button"
            onClick={() => setMetodo(o.v)}
            className={cn(
              "flex flex-col items-center gap-1 rounded-lg border px-2 py-2 text-xs font-medium transition-colors",
              metodo === o.v ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted",
            )}
          >
            {o.icon}
            {o.label}
          </button>
        ))}
      </div>

      {metodo === "EFECTIVO" && (
        <div className="space-y-1.5">
          <Label htmlFor="recibido">Recibido (opcional)</Label>
          <Input
            id="recibido"
            type="number"
            min={0}
            value={recibido}
            onChange={(e) => setRecibido(e.target.value)}
          />
          {recibidoNum > total && (
            <p className="text-xs text-muted-foreground">
              Cambio: {formatMoney(recibidoNum - total)}
            </p>
          )}
        </div>
      )}

      {metodo === "TRANSFERENCIA" && (
        <div className="space-y-2">
          {metodos.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {metodos.map((m) => (
                <button
                  key={m.id_qr}
                  type="button"
                  onClick={() => setSubtipo(m.nombre)}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-xs",
                    subtipo === m.nombre
                      ? "border-primary bg-primary/10 text-primary"
                      : "hover:bg-muted",
                  )}
                >
                  {m.nombre}
                </button>
              ))}
            </div>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*,application/pdf"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void subir(f);
              e.target.value = "";
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full gap-1.5"
            onClick={() => fileRef.current?.click()}
            disabled={subiendo}
          >
            {subiendo ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Upload className="h-3.5 w-3.5" />
            )}
            {url
              ? url === d.url_comprobante
                ? "Usar otro comprobante"
                : "Comprobante cargado · cambiar"
              : "Subir comprobante"}
          </Button>
          {url && url === d.url_comprobante && (
            <p className="text-xs text-muted-foreground">
              Se usará el comprobante que envió el cliente.
            </p>
          )}
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={aprobar} onCheckedChange={(v) => setAprobar(v === true)} />
            Ya verifiqué que el dinero llegó
          </label>
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="propina">Propina (opcional)</Label>
        <Input
          id="propina"
          type="number"
          min={0}
          value={propina}
          onChange={(e) => setPropina(e.target.value)}
        />
      </div>

      <div className="flex gap-2">
        <Button variant="ghost" onClick={onCancel} disabled={mut.isPending}>
          Volver
        </Button>
        <Button className="flex-1" onClick={() => mut.mutate()} disabled={!valido || mut.isPending}>
          {mut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Registrar {formatMoney(total)}
        </Button>
      </div>
    </div>
  );
}

function CancelarPanel({ d, onClose }: { d: Domicilio; onClose: () => void }) {
  const qc = useQueryClient();
  const [motivo, setMotivo] = useState("");
  const [reponer, setReponer] = useState(true);
  const enCocina = d.estado !== "PENDIENTE";
  const mut = useMutation({
    mutationFn: () =>
      cancelarDomicilio({
        idDomicilio: d.id_domicilio,
        motivo: motivo.trim() || undefined,
        reponer,
      }),
    onSuccess: () => {
      toast.success(`${d.codigo} cancelado`);
      void qc.invalidateQueries({ queryKey: ["domicilios", "tablero"] });
      onClose();
    },
    onError: (e) => toast.error("No se pudo cancelar", { description: errorMsg(e) }),
  });
  return (
    <div className="space-y-3 rounded-xl border border-destructive/40 p-3">
      <p className="text-sm font-medium">¿Cancelar {d.codigo}?</p>
      <Textarea
        placeholder="Motivo (lo verá el cliente en el seguimiento)"
        value={motivo}
        onChange={(e) => setMotivo(e.target.value.slice(0, 300))}
        rows={2}
      />
      {enCocina && (
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={reponer} onCheckedChange={(v) => setReponer(v === true)} />
          Devolver los insumos al inventario (si no, quedan como merma)
        </label>
      )}
      <div className="flex gap-2">
        <Button variant="ghost" onClick={onClose} disabled={mut.isPending}>
          Volver
        </Button>
        <Button
          variant="destructive"
          className="flex-1"
          onClick={() => mut.mutate()}
          disabled={mut.isPending}
        >
          {mut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Cancelar pedido
        </Button>
      </div>
    </div>
  );
}
