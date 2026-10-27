import { Link } from "@tanstack/react-router";
import { Bike, ChevronRight, Clock3, MapPin, ShoppingBag } from "lucide-react";
import type { CartaNegocio } from "@/lib/menu-publico.functions";
import type { TipoEntrega } from "@/lib/domicilios-publico.functions";
import { formatMoney } from "@/lib/format";
import { enlaceWhatsApp } from "@/lib/whatsapp";
import { InstagramIcon, WhatsAppIcon } from "./iconos-marca";
import type { PedidoReciente } from "./carrito";

/**
 * Portada de la carta pública. Todo el color sale de las variables del tema elegido en
 * Configuración (--menu-*): los halos usan primary/accent mezclados sobre el fondo, así que
 * cada tema produce una portada distinta sin estilos por tema.
 */
export function CartaHero({
  negocio,
  logoUrl,
  envioDesde,
  tipo,
  onTipo,
  pedidoEnCurso,
  conFondo = false,
}: {
  negocio: CartaNegocio;
  logoUrl: string | null;
  envioDesde: number | null;
  tipo: TipoEntrega;
  onTipo: (t: TipoEntrega) => void;
  pedidoEnCurso: PedidoReciente | null;
  /** Hay imagen/video de fondo (FondoMedia): la portada se vuelve transparente y alta. */
  conFondo?: boolean;
}) {
  const domicilio = negocio.domicilios_activo === true;
  const recoger = negocio.recoger_activo === true;
  const pide = domicilio || recoger;
  const wa = enlaceWhatsApp(
    negocio.whatsapp_numero,
    `Hola ${negocio.nombre_comercial}, quiero hacer un pedido.`,
  );
  const minimo = Number(negocio.pedido_minimo ?? 0);

  return (
    <header
      className={`relative isolate overflow-hidden ${
        conFondo ? "flex min-h-[48svh] flex-col justify-end lg:min-h-[42vh]" : ""
      }`}
    >
      {!conFondo && (
        <>
          <div
            aria-hidden
            className="absolute inset-0 -z-10"
            style={{
              background: `
            radial-gradient(120% 80% at 0% 0%, color-mix(in oklab, var(--menu-primary) 26%, transparent), transparent 60%),
            radial-gradient(90% 70% at 100% 10%, color-mix(in oklab, var(--menu-accent) 30%, transparent), transparent 55%),
            var(--menu-gradient, var(--menu-bg))`,
            }}
          />
          <div
            aria-hidden
            className="absolute -right-16 -top-16 -z-10 h-56 w-56 rounded-full opacity-40 blur-3xl"
            style={{ background: "var(--menu-accent)" }}
          />
        </>
      )}

      <div className="mx-auto w-full max-w-6xl px-5 pb-6 pt-[max(1.5rem,env(safe-area-inset-top))]">
        <div className="flex items-center justify-between gap-3">
          {pide ? (
            <span
              className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold"
              style={{
                background: "color-mix(in oklab, var(--menu-surface) 75%, transparent)",
                border: "1px solid var(--menu-border)",
              }}
            >
              <span className="relative flex h-2 w-2">
                <span
                  className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60"
                  style={{ background: "var(--menu-primary)" }}
                />
                <span
                  className="relative inline-flex h-2 w-2 rounded-full"
                  style={{ background: "var(--menu-primary)" }}
                />
              </span>
              Recibiendo pedidos
            </span>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            {negocio.instagram_url && (
              <a
                href={negocio.instagram_url}
                target="_blank"
                rel="noreferrer"
                aria-label="Instagram"
                className="flex h-9 w-9 items-center justify-center rounded-full transition-transform active:scale-95"
                style={{
                  background: "var(--menu-surface)",
                  border: "1px solid var(--menu-border)",
                }}
              >
                <InstagramIcon className="h-4 w-4" />
              </a>
            )}
            {wa && (
              <a
                href={wa}
                target="_blank"
                rel="noreferrer"
                aria-label="WhatsApp"
                className="flex h-9 w-9 items-center justify-center rounded-full transition-transform active:scale-95"
                style={{
                  background: "var(--menu-surface)",
                  border: "1px solid var(--menu-border)",
                }}
              >
                <WhatsAppIcon className="h-4 w-4" />
              </a>
            )}
          </div>
        </div>

        <div className="mt-6 flex items-center gap-4">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={negocio.nombre_comercial}
              width={80}
              height={80}
              decoding="async"
              className="h-20 w-20 shrink-0 object-cover"
              style={{
                borderRadius: "calc(var(--menu-radius) + 0.5rem)",
                boxShadow:
                  "0 0 0 3px var(--menu-surface), 0 0 0 5px var(--menu-accent), var(--menu-shadow, none)",
              }}
            />
          ) : null}
          <div className="min-w-0">
            <h1
              className="text-3xl font-bold leading-[1.05] sm:text-4xl lg:text-5xl"
              style={{ fontFamily: "var(--menu-heading-font)" }}
            >
              {negocio.nombre_comercial}
            </h1>
            {negocio.direccion && (
              <p
                className="mt-1 flex items-center gap-1 text-sm"
                style={{ color: "var(--menu-muted)" }}
              >
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{negocio.direccion}</span>
              </p>
            )}
          </div>
        </div>

        {pide && (
          <>
            <div className="mt-5 flex flex-wrap gap-2 text-xs font-medium">
              {negocio.tiempo_estimado_min ? (
                <Chip icon={<Clock3 className="h-3.5 w-3.5" />}>
                  ~{negocio.tiempo_estimado_min} min
                </Chip>
              ) : null}
              {domicilio && envioDesde != null ? (
                <Chip icon={<Bike className="h-3.5 w-3.5" />}>
                  Envío {envioDesde === 0 ? "gratis" : `desde ${formatMoney(envioDesde)}`}
                </Chip>
              ) : null}
              {minimo > 0 ? <Chip>Pedido mínimo {formatMoney(minimo)}</Chip> : null}
            </div>

            {domicilio && recoger && (
              <div
                role="radiogroup"
                aria-label="Tipo de entrega"
                className="mt-5 grid grid-cols-2 gap-1 p-1 lg:max-w-md"
                style={{
                  background: "color-mix(in oklab, var(--menu-surface) 80%, transparent)",
                  border: "1px solid var(--menu-border)",
                  borderRadius: "calc(var(--menu-radius) + 0.25rem)",
                }}
              >
                <OpcionEntrega activa={tipo === "DOMICILIO"} onClick={() => onTipo("DOMICILIO")}>
                  <Bike className="h-4 w-4" /> A domicilio
                </OpcionEntrega>
                <OpcionEntrega activa={tipo === "RECOGER"} onClick={() => onTipo("RECOGER")}>
                  <ShoppingBag className="h-4 w-4" /> Para recoger
                </OpcionEntrega>
              </div>
            )}
          </>
        )}

        {pedidoEnCurso && (
          <Link
            to="/pedido/$token"
            params={{ token: pedidoEnCurso.token }}
            className="mt-4 flex items-center gap-3 p-3 transition-transform active:scale-[0.99]"
            style={{
              background: "var(--menu-primary)",
              color: "var(--menu-primary-foreground)",
              borderRadius: "var(--menu-radius)",
              boxShadow: "var(--menu-shadow, none)",
            }}
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15">
              <Bike className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">Tu pedido {pedidoEnCurso.codigo}</span>
              <span className="block text-xs opacity-85">Toca para ver en qué va</span>
            </span>
            <ChevronRight className="h-5 w-5" />
          </Link>
        )}
      </div>
    </header>
  );
}

function Chip({ icon, children }: { icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5"
      style={{
        background: "color-mix(in oklab, var(--menu-surface) 85%, transparent)",
        border: "1px solid var(--menu-border)",
      }}
    >
      {icon}
      {children}
    </span>
  );
}

function OpcionEntrega({
  activa,
  onClick,
  children,
}: {
  activa: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={activa}
      onClick={onClick}
      className="flex items-center justify-center gap-2 py-2.5 text-sm font-semibold transition-colors"
      style={{
        borderRadius: "var(--menu-radius)",
        background: activa ? "var(--menu-primary)" : "transparent",
        color: activa ? "var(--menu-primary-foreground)" : "var(--menu-foreground)",
      }}
    >
      {children}
    </button>
  );
}
