import type { MenuTheme } from "@/lib/menu-themes";

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
          {nombreNegocio || "Nuestra carta"}
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
            {nombreNegocio || "Nuestra carta"}
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
              {nombreNegocio || "Nuestra carta"}
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
          {nombreNegocio || "Nuestra carta"}
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
export function CategoryNav({
  theme,
  categorias,
  activa,
  onSelect,
}: {
  theme: MenuTheme;
  categorias: { id_categoria: string; nombre: string }[];
  activa: string | null;
  onSelect: (id: string | null) => void;
}) {
  const style = theme.categoryStyle;
  const items: { id: string | null; nombre: string }[] = [
    { id: null, nombre: "Todo" },
    ...categorias.map((c) => ({ id: c.id_categoria, nombre: c.nombre })),
  ];

  if (style === "tabs-subrayadas") {
    return (
      <div className="flex gap-5 overflow-x-auto px-5 py-3 scrollbar-none">
        {items.map((it) => {
          const active = activa === it.id;
          return (
            <button
              key={it.id ?? "all"}
              type="button"
              onClick={() => onSelect(it.id)}
              className="shrink-0 pb-1.5 text-sm font-medium whitespace-nowrap transition-colors"
              style={{
                color: active ? "var(--menu-foreground)" : "var(--menu-muted)",
                borderBottom: active ? "2px solid var(--menu-accent)" : "2px solid transparent",
                fontFamily: "var(--menu-body-font)",
              }}
            >
              {it.nombre}
            </button>
          );
        })}
      </div>
    );
  }

  if (style === "chips-grandes") {
    return (
      <div className="flex gap-2.5 overflow-x-auto px-4 py-3 scrollbar-none">
        {items.map((it) => {
          const active = activa === it.id;
          return (
            <button
              key={it.id ?? "all"}
              type="button"
              onClick={() => onSelect(it.id)}
              className="shrink-0 px-5 py-2.5 text-sm font-semibold transition-all"
              style={{
                borderRadius: "9999px",
                background: active
                  ? (theme.vars["--menu-gradient"] ?? "var(--menu-primary)")
                  : "var(--menu-surface)",
                color: active ? "var(--menu-primary-foreground)" : "var(--menu-foreground)",
                boxShadow: active ? "var(--menu-shadow, 0 6px 18px -8px rgba(0,0,0,0.2))" : "none",
                fontFamily: "var(--menu-body-font)",
              }}
            >
              {it.nombre}
            </button>
          );
        })}
      </div>
    );
  }

  if (style === "tags-duros") {
    return (
      <div className="flex gap-2 overflow-x-auto px-4 py-3 scrollbar-none">
        {items.map((it) => {
          const active = activa === it.id;
          return (
            <button
              key={it.id ?? "all"}
              type="button"
              onClick={() => onSelect(it.id)}
              className="shrink-0 px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition-all"
              style={{
                background: active ? "var(--menu-foreground)" : "var(--menu-surface)",
                color: active ? "var(--menu-bg)" : "var(--menu-foreground)",
                border: "2px solid var(--menu-foreground)",
                borderRadius: "0px",
                fontFamily: "var(--menu-body-font)",
              }}
            >
              {it.nombre}
            </button>
          );
        })}
      </div>
    );
  }

  // pills (default)
  return (
    <div className="flex gap-2 overflow-x-auto px-4 py-3 scrollbar-none">
      {items.map((it) => {
        const active = activa === it.id;
        return (
          <button
            key={it.id ?? "all"}
            type="button"
            onClick={() => onSelect(it.id)}
            className="shrink-0 px-4 py-1.5 text-sm font-medium transition-colors"
            style={{
              borderRadius: "9999px",
              background: active ? "var(--menu-primary)" : "var(--menu-surface)",
              color: active ? "var(--menu-primary-foreground)" : "var(--menu-foreground)",
              borderColor: active ? "var(--menu-primary)" : "var(--menu-border)",
              borderWidth: 1,
              borderStyle: "solid",
              fontFamily: "var(--menu-body-font)",
            }}
          >
            {it.nombre}
          </button>
        );
      })}
    </div>
  );
}
