import { useEffect, useRef, useState } from "react";
import type { MenuTheme } from "@/lib/menu-themes";
import { TextoFijo } from "@/components/menu-publico/texto-fijo";

// Cromo compartido del menú público (header temático + navegación de categorías).
// Lo usan la carta por mesa (`/carta/$idMesa`) y el menú público del negocio
// (`/carta-publica/$idNegocio`). En el menú público NO hay mesa: `mesa` es opcional
// y, cuando falta, se omite el rótulo "Mesa X".

// ============================================================
// Header con variantes según el tema
// ============================================================
export function ThemedHeader({
  theme,
  mesa,
  nombreNegocio,
  logoUrl,
}: {
  theme: MenuTheme;
  mesa?: string;
  nombreNegocio: string;
  logoUrl: string | null;
}) {
  const style = theme.headerStyle;

  if (style === "hero-centrado") {
    return (
      <header
        className="px-4 pt-8 pb-6 text-center"
        style={{
          background: theme.vars["--menu-gradient"]
            ? "var(--menu-gradient)"
            : "var(--menu-surface)",
          borderBottom: "1px solid var(--menu-border)",
        }}
      >
        {logoUrl && (
          <img
            loading="lazy"
            decoding="async"
            src={logoUrl}
            alt={nombreNegocio}
            className="mx-auto h-20 w-20 rounded-full object-contain bg-white/70 p-1 mb-3"
            style={{ borderColor: "var(--menu-border)", borderWidth: 1 }}
          />
        )}
        {mesa && (
          <p
            className="text-[10px] uppercase tracking-[0.3em]"
            style={{ color: "var(--menu-accent)" }}
          >
            Mesa {mesa}
          </p>
        )}
        <h1
          className="mt-1 font-bold leading-tight line-clamp-2 break-words"
          style={{
            fontFamily: "var(--menu-heading-font)",
            fontSize: "clamp(1.25rem, 6vw, 1.875rem)",
          }}
        >
          {nombreNegocio ? <TextoFijo texto={nombreNegocio} /> : "Nuestra carta"}
        </h1>
        <div className="mx-auto mt-3 h-px w-16" style={{ background: "var(--menu-accent)" }} />
      </header>
    );
  }

  if (style === "banner-gradiente") {
    return (
      <header
        className="px-5 pt-6 pb-7 flex items-center gap-4"
        style={{
          background: theme.vars["--menu-gradient"] ?? "var(--menu-primary)",
          color: "var(--menu-primary-foreground)",
        }}
      >
        {logoUrl && (
          <img
            loading="lazy"
            decoding="async"
            src={logoUrl}
            alt={nombreNegocio}
            className="h-16 w-16 shrink-0 rounded-full object-contain bg-white/90 p-1"
          />
        )}
        <div className="min-w-0 flex-1">
          {mesa && <p className="text-[11px] uppercase tracking-widest opacity-80">Mesa {mesa}</p>}
          <h1
            className="font-bold leading-tight line-clamp-2 break-words"
            style={{
              fontFamily: "var(--menu-heading-font)",
              fontSize: "clamp(1.125rem, 5.5vw, 1.5rem)",
            }}
          >
            {nombreNegocio ? <TextoFijo texto={nombreNegocio} /> : "Nuestra carta"}
          </h1>
        </div>
      </header>
    );
  }

  if (style === "editorial") {
    return (
      <header
        className="px-5 pt-6 pb-5"
        style={{
          background: "var(--menu-surface)",
          borderBottom: "1px solid var(--menu-border)",
        }}
      >
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            {mesa && (
              <p
                className="text-[10px] uppercase tracking-[0.3em]"
                style={{ color: "var(--menu-accent)" }}
              >
                · Mesa {mesa} ·
              </p>
            )}
            <h1
              className="mt-1 font-bold leading-[1.05] italic line-clamp-2 break-words"
              style={{
                fontFamily: "var(--menu-heading-font)",
                fontSize: "clamp(1.5rem, 7vw, 1.875rem)",
              }}
            >
              {nombreNegocio ? <TextoFijo texto={nombreNegocio} /> : "Nuestra carta"}
            </h1>
          </div>
          {logoUrl && (
            <img
              loading="lazy"
              decoding="async"
              src={logoUrl}
              alt={nombreNegocio}
              className="h-14 w-14 shrink-0 rounded-full object-contain bg-white/40 p-0.5"
              style={{ borderColor: "var(--menu-border)", borderWidth: 1 }}
            />
          )}
        </div>
        <div className="mt-3 flex items-center gap-2" aria-hidden>
          <div className="h-px flex-1" style={{ background: "var(--menu-border)" }} />
          <div className="text-xs tracking-widest" style={{ color: "var(--menu-muted)" }}>
            CARTA
          </div>
          <div className="h-px flex-1" style={{ background: "var(--menu-border)" }} />
        </div>
      </header>
    );
  }

  // minimal
  return (
    <header
      className="flex items-center gap-3 px-4 pt-4 pb-3"
      style={{
        background: "var(--menu-surface)",
        borderBottom: "1px solid var(--menu-border)",
      }}
    >
      <div className="min-w-0 flex-1">
        {mesa && (
          <p
            className="text-[11px] uppercase tracking-wider"
            style={{ color: "var(--menu-muted)" }}
          >
            Mesa {mesa}
          </p>
        )}
        <h1
          className="font-bold leading-tight line-clamp-2 break-words"
          style={{
            fontFamily: "var(--menu-heading-font)",
            fontSize: "clamp(1rem, 4.5vw, 1.25rem)",
          }}
        >
          {nombreNegocio ? <TextoFijo texto={nombreNegocio} /> : "Nuestra carta"}
        </h1>
      </div>
      {logoUrl && (
        <img
          loading="lazy"
          decoding="async"
          src={logoUrl}
          alt={nombreNegocio}
          className="h-12 w-12 shrink-0 rounded-full object-contain bg-white/40 p-0.5"
          style={{ borderColor: "var(--menu-border)", borderWidth: 1 }}
        />
      )}
    </header>
  );
}

// ============================================================
// Navegación de categorías con variantes
// ============================================================
// La carta es una sola lista por secciones: `activa` la decide el scroll-spy y `onSelect`
// hace scroll a la sección (null = portada). El chip activo se centra solo y, en los
// estilos `neon` y `tabs-subrayadas`, un indicador se desliza hasta él (easeOutQuint).
export function CategoryNav({
  theme,
  categorias,
  activa,
  onSelect,
  etiquetaInicio = "Inicio",
}: {
  theme: MenuTheme;
  categorias: { id_categoria: string; nombre: string }[];
  activa: string | null;
  onSelect: (id: string | null) => void;
  etiquetaInicio?: string;
}) {
  const style = theme.categoryStyle;
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const botones = useRef(new Map<string, HTMLButtonElement>());
  const [indicador, setIndicador] = useState<{ x: number; w: number } | null>(null);
  const items: { id: string | null; nombre: string }[] = [
    { id: null, nombre: etiquetaInicio },
    ...categorias.map((c) => ({ id: c.id_categoria, nombre: c.nombre })),
  ];
  const deslizante = style === "neon" || style === "tabs-subrayadas";

  useEffect(() => {
    const medir = () => {
      const el = botones.current.get(activa ?? "__inicio");
      const sc = scrollerRef.current;
      if (!el || !sc) return;
      setIndicador({ x: el.offsetLeft, w: el.offsetWidth });
      const destino = el.offsetLeft - sc.clientWidth / 2 + el.offsetWidth / 2;
      sc.scrollTo({ left: Math.max(0, destino), behavior: "smooth" });
    };
    medir();
    // Las web fonts cambian el ancho de los chips al cargar: re-medir.
    const ro = new ResizeObserver(medir);
    if (scrollerRef.current) ro.observe(scrollerRef.current);
    return () => ro.disconnect();
  }, [activa, categorias]);

  const ref = (id: string | null) => (el: HTMLButtonElement | null) => {
    if (el) botones.current.set(id ?? "__inicio", el);
    else botones.current.delete(id ?? "__inicio");
  };

  const estilos = (active: boolean): { className: string; style: React.CSSProperties } => {
    switch (style) {
      case "neon":
        return {
          className:
            "relative z-10 shrink-0 px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors duration-300",
          style: {
            borderRadius: "9999px",
            color: active ? "var(--menu-primary-foreground)" : "var(--menu-muted)",
            fontFamily: "var(--menu-body-font)",
          },
        };
      case "tabs-subrayadas":
        return {
          className:
            "relative z-10 shrink-0 pb-2 pt-1 text-sm font-medium whitespace-nowrap transition-colors",
          style: {
            color: active ? "var(--menu-foreground)" : "var(--menu-muted)",
            fontFamily: "var(--menu-body-font)",
          },
        };
      case "chips-grandes":
        return {
          className: "shrink-0 px-5 py-2.5 text-sm font-semibold transition-all",
          style: {
            borderRadius: "9999px",
            background: active
              ? (theme.vars["--menu-gradient"] ?? "var(--menu-primary)")
              : "var(--menu-surface)",
            color: active ? "var(--menu-primary-foreground)" : "var(--menu-foreground)",
            boxShadow: active ? "var(--menu-shadow, 0 6px 18px -8px rgba(0,0,0,0.2))" : "none",
            fontFamily: "var(--menu-body-font)",
          },
        };
      case "tags-duros":
        return {
          className:
            "shrink-0 px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition-all",
          style: {
            background: active ? "var(--menu-foreground)" : "var(--menu-surface)",
            color: active ? "var(--menu-bg)" : "var(--menu-foreground)",
            border: "2px solid var(--menu-foreground)",
            borderRadius: "0px",
            fontFamily: "var(--menu-body-font)",
          },
        };
      default:
        return {
          className: "shrink-0 px-4 py-1.5 text-sm font-medium transition-colors",
          style: {
            borderRadius: "9999px",
            background: active ? "var(--menu-primary)" : "var(--menu-surface)",
            color: active ? "var(--menu-primary-foreground)" : "var(--menu-foreground)",
            borderColor: active ? "var(--menu-primary)" : "var(--menu-border)",
            borderWidth: 1,
            borderStyle: "solid",
            fontFamily: "var(--menu-body-font)",
          },
        };
    }
  };

  return (
    <div
      ref={scrollerRef}
      role="tablist"
      aria-label="Categorías del menú"
      className={`relative flex overflow-x-auto px-4 py-2.5 scrollbar-none ${
        style === "tabs-subrayadas" ? "gap-5" : "gap-2"
      }`}
    >
      {deslizante && indicador && (
        <span
          aria-hidden
          className="menu-indicador pointer-events-none absolute left-0"
          style={
            style === "neon"
              ? {
                  top: 10,
                  bottom: 10,
                  width: indicador.w,
                  transform: `translateX(${indicador.x}px)`,
                  borderRadius: "9999px",
                  background: theme.vars["--menu-gradient"] ?? "var(--menu-primary)",
                  boxShadow:
                    "0 0 24px -4px color-mix(in oklab, var(--menu-primary) 70%, transparent)",
                }
              : {
                  bottom: 10,
                  height: 2,
                  width: indicador.w,
                  transform: `translateX(${indicador.x}px)`,
                  background: "var(--menu-accent)",
                }
          }
        />
      )}
      {items.map((it) => {
        const active = activa === it.id;
        const { className, style: st } = estilos(active);
        return (
          <button
            key={it.id ?? "__inicio"}
            ref={ref(it.id)}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onSelect(it.id)}
            className={`min-h-9 ${className}`}
            style={st}
          >
            {it.id ? <TextoFijo texto={it.nombre} /> : it.nombre}
          </button>
        );
      })}
    </div>
  );
}
