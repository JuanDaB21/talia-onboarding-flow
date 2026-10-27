import { useEffect, useMemo, useRef } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Bike,
  Check,
  ChefHat,
  CircleX,
  Loader2,
  PackageCheck,
  Paperclip,
  Receipt,
  ShoppingBag,
} from "lucide-react";
import { toast } from "sonner";
import {
  getSeguimientoDomicilio,
  subirComprobanteDomicilio,
  type SeguimientoDomicilio,
} from "@/lib/domicilios-publico.functions";
import { formatMoney } from "@/lib/format";
import { pollWhen, POLL } from "@/lib/query-config";
import { publicUrl } from "@/lib/storage";
import { enlaceWhatsApp } from "@/lib/whatsapp";
import { getThemeStyle } from "@/lib/menu-themes";
import { useMenuFonts } from "@/hooks/use-menu-fonts";
import { WhatsAppIcon } from "@/components/menu-publico/pedido/iconos-marca";

export const Route = createFileRoute("/pedido/$token")({
  validateSearch: (s: Record<string, unknown>): { nuevo?: 1 } => (s.nuevo ? { nuevo: 1 } : {}),
  head: () => ({
    meta: [
      { title: "Tu pedido — Talia" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SeguimientoPage,
});

const FINALES = new Set(["ENTREGADO", "CANCELADO"]);

interface Paso {
  key: string;
  titulo: string;
  detalle: string;
  at: string | null;
  icon: React.ReactNode;
}

function pasosDe(d: SeguimientoDomicilio): Paso[] {
  const domicilio = d.tipo === "DOMICILIO";
  const pasos: Paso[] = [
    {
      key: "PENDIENTE",
      titulo: "Pedido recibido",
      detalle: "El restaurante lo está revisando",
      at: d.created_at,
      icon: <Receipt className="h-4 w-4" />,
    },
    {
      key: "EN_PREPARACION",
      titulo: "En preparación",
      detalle: "Confirmado y en la cocina",
      at: d.confirmado_at,
      icon: <ChefHat className="h-4 w-4" />,
    },
    {
      key: "LISTO",
      titulo: domicilio ? "Listo para salir" : "Listo para recoger",
      detalle: domicilio ? "Empacado, esperando al domiciliario" : "Ya puedes pasar por él",
      at: d.listo_at,
      icon: <PackageCheck className="h-4 w-4" />,
    },
  ];
  if (domicilio)
    pasos.push({
      key: "EN_CAMINO",
      titulo: "En camino",
      detalle: "Va hacia tu dirección",
      at: d.en_camino_at,
      icon: <Bike className="h-4 w-4" />,
    });
  pasos.push({
    key: "ENTREGADO",
    titulo: "Entregado",
    detalle: "¡Buen provecho!",
    at: d.entregado_at,
    icon: <Check className="h-4 w-4" />,
  });
  return pasos;
}

const hora = (iso: string | null) =>
  iso ? new Date(iso).toLocaleTimeString("es-CO", { hour: "numeric", minute: "2-digit" }) : "";

function SeguimientoPage() {
  const { token } = Route.useParams();
  const { nuevo } = Route.useSearch();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["domicilio-publico", token],
    queryFn: () => getSeguimientoDomicilio(token),
    retry: 1,
    ...pollWhen(true, POLL.REALTIME),
    refetchInterval: (q) =>
      q.state.data && FINALES.has(q.state.data.estado) ? false : POLL.REALTIME.refetchInterval,
  });

  const subir = useMutation({
    mutationFn: (f: File) => subirComprobanteDomicilio(token, f),
    onSuccess: () => {
      toast.success("Comprobante enviado");
      void qc.invalidateQueries({ queryKey: ["domicilio-publico", token] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "No se pudo subir"),
  });

  const themeId = data?.negocio.tema_menu;
  const themeStyle = useMemo(() => getThemeStyle(themeId), [themeId]);
  useMenuFonts(themeId);

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </main>
    );
  }
  if (isError || !data) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-6 text-center">
        <div className="space-y-2">
          <h1 className="text-xl font-semibold">Pedido no encontrado</h1>
          <p className="text-sm text-muted-foreground">Revisa el enlace que recibiste.</p>
        </div>
      </main>
    );
  }

  const n = data.negocio;
  const cancelado = data.estado === "CANCELADO";
  const pasos = pasosDe(data);
  const actual = Math.max(
    0,
    pasos.findIndex((p) => p.key === data.estado),
  );
  const pasoActual = pasos[actual];
  const productos = data.items.map((i) => `${i.cantidad}x ${i.nombre}`).join(", ");
  const waEstado = enlaceWhatsApp(
    n.whatsapp_numero,
    `Hola ${n.nombre_comercial}, quiero saber el estado de mi pedido ${data.codigo}.`,
  );
  const waPago = enlaceWhatsApp(
    n.whatsapp_numero,
    `Hola, realicé el pago de mi pedido ${data.codigo}. Total: ${formatMoney(data.total)}. Productos: ${productos}. Adjunto la foto del comprobante.`,
  );
  const transferencia = data.metodo_pago === "TRANSFERENCIA";
  const abierto = !FINALES.has(data.estado);
  const logo = publicUrl(n.url_logo);

  return (
    <main
      className="min-h-screen pb-16"
      style={{
        ...themeStyle,
        background: "var(--menu-bg)",
        color: "var(--menu-foreground)",
        fontFamily: "var(--menu-body-font)",
      }}
    >
      <header
        className="relative isolate overflow-hidden px-5 pb-8 pt-5"
        style={{
          background: cancelado
            ? "var(--menu-surface-2)"
            : "linear-gradient(160deg, var(--menu-primary), color-mix(in oklab, var(--menu-primary) 60%, var(--menu-accent)))",
          color: cancelado ? "var(--menu-foreground)" : "var(--menu-primary-foreground)",
        }}
      >
        <div
          aria-hidden
          className="absolute -right-10 -top-10 -z-10 h-48 w-48 rounded-full opacity-30 blur-2xl"
          style={{ background: "var(--menu-accent)" }}
        />
        <div className="mx-auto flex max-w-lg items-center justify-between">
          <Link
            to="/carta-publica/$idNegocio"
            params={{ idNegocio: n.id_negocio }}
            className="flex items-center gap-1.5 text-sm font-medium opacity-90"
          >
            <ArrowLeft className="h-4 w-4" /> Menú
          </Link>
          <span className="rounded-full bg-white/15 px-3 py-1 font-mono text-xs font-semibold">
            {data.codigo}
          </span>
        </div>
        <div className="mx-auto mt-6 max-w-lg">
          <div className="flex items-center gap-3">
            {logo && (
              <img
                src={logo}
                alt=""
                className="h-10 w-10 rounded-full object-cover ring-2 ring-white/40"
              />
            )}
            <p className="text-sm font-medium opacity-90">{n.nombre_comercial}</p>
          </div>
          {nuevo && !cancelado && actual === 0 ? (
            <p className="mt-4 text-sm font-semibold uppercase tracking-wider opacity-80">
              ¡Pedido enviado!
            </p>
          ) : null}
          <h1
            className="mt-1 text-3xl font-bold leading-tight"
            style={{ fontFamily: "var(--menu-heading-font)" }}
          >
            {cancelado ? "Pedido cancelado" : pasoActual.titulo}
          </h1>
          <p className="mt-1 text-sm opacity-90">
            {cancelado
              ? data.motivo_cancelacion || "El restaurante canceló este pedido."
              : pasoActual.detalle}
            {!cancelado && actual < 2 && n.tiempo_estimado_min
              ? ` · ~${n.tiempo_estimado_min} min`
              : ""}
          </p>
        </div>
      </header>

      <div className="mx-auto -mt-4 max-w-lg space-y-4 px-4">
        {!cancelado && (
          <section
            className="p-5"
            style={{
              background: "var(--menu-surface)",
              border: "1px solid var(--menu-border)",
              borderRadius: "calc(var(--menu-radius) + 0.25rem)",
              boxShadow: "var(--menu-shadow, none)",
            }}
          >
            <ol className="relative space-y-5">
              {pasos.map((p, i) => {
                const hecho = i < actual || data.estado === "ENTREGADO";
                const activo = i === actual && data.estado !== "ENTREGADO";
                return (
                  <li key={p.key} className="relative flex gap-3">
                    {i < pasos.length - 1 && (
                      <span
                        aria-hidden
                        className="absolute left-[15px] top-8 h-[calc(100%-4px)] w-0.5"
                        style={{
                          background: i < actual ? "var(--menu-primary)" : "var(--menu-border)",
                        }}
                      />
                    )}
                    <span
                      className={`relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${activo ? "ring-4" : ""}`}
                      style={
                        {
                          background:
                            hecho || activo ? "var(--menu-primary)" : "var(--menu-surface-2)",
                          color:
                            hecho || activo
                              ? "var(--menu-primary-foreground)"
                              : "var(--menu-muted)",
                          // Color del ring de Tailwind tomado del tema.
                          "--tw-ring-color":
                            "color-mix(in oklab, var(--menu-primary) 25%, transparent)",
                        } as React.CSSProperties
                      }
                    >
                      {activo && (
                        <span
                          className="absolute inset-0 animate-ping rounded-full opacity-40"
                          style={{ background: "var(--menu-primary)" }}
                        />
                      )}
                      {hecho ? <Check className="h-4 w-4" strokeWidth={3} /> : p.icon}
                    </span>
                    <div className="min-w-0 flex-1 pt-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <p
                          className={`text-sm ${hecho || activo ? "font-semibold" : ""}`}
                          style={{ color: hecho || activo ? undefined : "var(--menu-muted)" }}
                        >
                          {p.titulo}
                        </p>
                        <span
                          className="text-xs tabular-nums"
                          style={{ color: "var(--menu-muted)" }}
                        >
                          {hora(p.at)}
                        </span>
                      </div>
                      {activo && (
                        <p className="text-xs" style={{ color: "var(--menu-muted)" }}>
                          {p.detalle}
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>
        )}

        {transferencia && abierto && (
          <section
            className="space-y-3 p-5"
            style={{
              background: "var(--menu-surface)",
              border: "1px solid var(--menu-border)",
              borderRadius: "calc(var(--menu-radius) + 0.25rem)",
            }}
          >
            <h2 className="text-sm font-semibold">Pago por transferencia</h2>
            {data.pagado ? (
              <p className="flex items-center gap-2 text-sm">
                <Check className="h-4 w-4" style={{ color: "var(--menu-primary)" }} /> Pago
                verificado
              </p>
            ) : data.comprobante_subido ? (
              <p className="text-sm" style={{ color: "var(--menu-muted)" }}>
                Recibimos tu comprobante. Caja lo verificará en un momento.
              </p>
            ) : (
              <>
                <p className="text-sm" style={{ color: "var(--menu-muted)" }}>
                  Adjunta el comprobante de {formatMoney(data.total)} para que confirmemos tu pedido
                  más rápido.
                </p>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*,application/pdf"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) subir.mutate(f);
                    e.target.value = "";
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={subir.isPending}
                  className="flex h-11 w-full items-center justify-center gap-2 text-sm font-semibold disabled:opacity-60"
                  style={{
                    background: "var(--menu-primary)",
                    color: "var(--menu-primary-foreground)",
                    borderRadius: "var(--menu-radius)",
                  }}
                >
                  {subir.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Paperclip className="h-4 w-4" />
                  )}
                  Subir comprobante
                </button>
              </>
            )}
            {waPago && !data.pagado && (
              <a
                href={waPago}
                target="_blank"
                rel="noreferrer"
                className="flex h-11 w-full items-center justify-center gap-2 text-sm font-semibold"
                style={{
                  border: "1px solid var(--menu-border)",
                  borderRadius: "var(--menu-radius)",
                }}
              >
                <WhatsAppIcon className="h-4 w-4" /> Enviar comprobante por WhatsApp
              </a>
            )}
          </section>
        )}

        <section
          className="space-y-3 p-5"
          style={{
            background: "var(--menu-surface)",
            border: "1px solid var(--menu-border)",
            borderRadius: "calc(var(--menu-radius) + 0.25rem)",
          }}
        >
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Resumen</h2>
            <span
              className="flex items-center gap-1.5 text-xs"
              style={{ color: "var(--menu-muted)" }}
            >
              {data.tipo === "DOMICILIO" ? (
                <Bike className="h-3.5 w-3.5" />
              ) : (
                <ShoppingBag className="h-3.5 w-3.5" />
              )}
              {data.tipo === "DOMICILIO" ? "Domicilio" : "Para recoger"}
            </span>
          </div>
          <ul className="space-y-1.5 text-sm">
            {data.items.map((i) => (
              <li key={`${i.nombre}-${i.detalle}`} className="flex justify-between gap-3">
                <span className="min-w-0">
                  <span className="font-semibold tabular-nums">{i.cantidad}×</span> {i.nombre}
                  {i.detalle && (
                    <span className="block text-xs" style={{ color: "var(--menu-muted)" }}>
                      {i.detalle}
                    </span>
                  )}
                </span>
                <span className="shrink-0 tabular-nums">{formatMoney(i.subtotal)}</span>
              </li>
            ))}
          </ul>
          <dl
            className="space-y-1 pt-2 text-sm"
            style={{ borderTop: "1px dashed var(--menu-border)" }}
          >
            {data.tipo === "DOMICILIO" && (
              <div className="flex justify-between">
                <dt style={{ color: "var(--menu-muted)" }}>
                  Envío{data.municipio ? ` · ${data.municipio}` : ""}
                </dt>
                <dd>{data.costo_envio === 0 ? "Gratis" : formatMoney(data.costo_envio)}</dd>
              </div>
            )}
            <div className="flex justify-between text-base font-bold">
              <dt>Total</dt>
              <dd>{formatMoney(data.total)}</dd>
            </div>
            <div className="flex justify-between text-xs" style={{ color: "var(--menu-muted)" }}>
              <dt>Pago</dt>
              <dd>
                {data.metodo_pago === "EFECTIVO"
                  ? `Efectivo${data.paga_con ? ` · pagas con ${formatMoney(data.paga_con)}` : ""}`
                  : data.metodo_pago === "EN_LOCAL"
                    ? "En el local"
                    : "Transferencia"}
              </dd>
            </div>
          </dl>
          {data.direccion && (
            <p className="text-xs" style={{ color: "var(--menu-muted)" }}>
              Entrega en {data.direccion}
            </p>
          )}
        </section>

        {waEstado && (
          <a
            href={waEstado}
            target="_blank"
            rel="noreferrer"
            className="flex h-12 w-full items-center justify-center gap-2 text-sm font-semibold"
            style={{
              background: "var(--menu-foreground)",
              color: "var(--menu-bg)",
              borderRadius: "var(--menu-radius)",
            }}
          >
            <WhatsAppIcon className="h-5 w-5" />
            {cancelado ? "Escribir al restaurante" : "Preguntar por mi pedido"}
          </a>
        )}
        {cancelado && (
          <p
            className="flex items-center justify-center gap-1.5 text-xs"
            style={{ color: "var(--menu-muted)" }}
          >
            <CircleX className="h-3.5 w-3.5" /> Si ya pagaste, el restaurante te contactará.
          </p>
        )}
      </div>
    </main>
  );
}
