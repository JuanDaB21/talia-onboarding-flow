import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { LayoutGrid, Search, X } from "lucide-react";
import type { CartaCategoria, CartaProducto } from "@/lib/menu-publico.functions";
import type { MenuTheme } from "@/lib/menu-themes";
import { CategoryNav } from "@/components/menu-publico/menu-chrome";
import { CategoriaTiles, type TileCategoria } from "@/components/menu-publico/categoria-tiles";
import { TextoFijo } from "@/components/menu-publico/texto-fijo";

// Columnas por layout del tema: 1–2 en móvil, más en PC (el sidebar ocupa la izquierda).
const GRID: Record<MenuTheme["productLayout"], string> = {
  "hero-grid": "grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4",
  "vertical-grande": "grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3",
  horizontal: "grid grid-cols-1 gap-3 lg:grid-cols-2",
  "lista-densa": "divide-y",
};

const reducirMovimiento = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;

/**
 * Cuerpo compartido de la carta (mesa QR y carta pública): portada de tiles por categoría,
 * barra sticky con buscador + categorías (scroll-spy), sidebar en PC, índice en móvil y una
 * sola lista por secciones. Cada ruta aporta sus acciones a través de `renderProducto`.
 */
export function MenuCuerpo({
  theme,
  categorias,
  productos,
  filtrando,
  renderProducto,
  barraSuperior,
  vacio,
}: {
  theme: MenuTheme;
  categorias: CartaCategoria[];
  /** Productos ya filtrados por la búsqueda. */
  productos: CartaProducto[];
  /** Hay búsqueda activa: se ocultan la portada y los encabezados vacíos. */
  filtrando: boolean;
  renderProducto: (p: CartaProducto) => ReactNode;
  barraSuperior?: ReactNode;
  vacio: string;
}) {
  const raizRef = useRef<HTMLDivElement | null>(null);
  const barraRef = useRef<HTMLDivElement | null>(null);
  const [alturaBarra, setAlturaBarra] = useState(64);
  const [activa, setActiva] = useState<string | null>(null);
  const [indiceAbierto, setIndiceAbierto] = useState(false);
  const bloqueoHasta = useRef(0);

  const secciones = useMemo(() => {
    const porCat = new Map<string, CartaProducto[]>();
    for (const p of productos) {
      const arr = porCat.get(p.id_categoria);
      if (arr) arr.push(p);
      else porCat.set(p.id_categoria, [p]);
    }
    return categorias
      .filter((c) => porCat.has(c.id_categoria))
      .map((c) => ({ ...c, productos: porCat.get(c.id_categoria)! }));
  }, [categorias, productos]);

  const tiles = useMemo<TileCategoria[]>(
    () =>
      secciones.map((s) => ({
        id_categoria: s.id_categoria,
        nombre: s.nombre,
        imagen: s.url_imagen ?? s.productos.find((p) => p.url_imagen)?.url_imagen ?? null,
        total: s.productos.length,
      })),
    [secciones],
  );

  // Altura real de la barra sticky → offset del scroll y del scroll-spy.
  useEffect(() => {
    const el = barraRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setAlturaBarra(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Scroll-spy: la sección activa es la última cuyo inicio ya pasó bajo la barra sticky.
  useEffect(() => {
    let raf = 0;
    const calcular = () => {
      raf = 0;
      if (Date.now() < bloqueoHasta.current) return;
      const limite = alturaBarra + 24;
      let actual: string | null = null;
      for (const s of secciones) {
        const el = document.getElementById(`cat-${s.id_categoria}`);
        if (el && el.getBoundingClientRect().top <= limite) actual = s.id_categoria;
      }
      setActiva(actual);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(calcular);
    };
    calcular();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [secciones, alturaBarra]);

  // Entrada escalonada de tiles y tarjetas al aparecer en pantalla.
  useEffect(() => {
    const raiz = raizRef.current;
    if (!raiz) return;
    const pendientes = raiz.querySelectorAll<HTMLElement>(".menu-revelar:not([data-visible])");
    if (typeof IntersectionObserver === "undefined" || reducirMovimiento()) {
      pendientes.forEach((el) => el.setAttribute("data-visible", ""));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          e.target.setAttribute("data-visible", "");
          io.unobserve(e.target);
        }
      },
      { rootMargin: "0px 0px -6% 0px", threshold: 0.08 },
    );
    pendientes.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [secciones, filtrando]);

  useEffect(() => {
    if (!indiceAbierto) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setIndiceAbierto(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [indiceAbierto]);

  const irA = useCallback(
    (id: string | null) => {
      setIndiceAbierto(false);
      setActiva(id);
      bloqueoHasta.current = Date.now() + 900;
      const behavior: ScrollBehavior = reducirMovimiento() ? "auto" : "smooth";
      if (!id) {
        const top = (raizRef.current?.getBoundingClientRect().top ?? 0) + window.scrollY;
        window.scrollTo({ top: Math.max(0, top - 8), behavior });
        return;
      }
      const el = document.getElementById(`cat-${id}`);
      if (!el) return;
      const top = el.getBoundingClientRect().top + window.scrollY - alturaBarra - 12;
      window.scrollTo({ top, behavior });
    },
    [alturaBarra],
  );

  const mostrarPortada = !filtrando && tiles.length > 1;
  const conNav = secciones.length > 1;
  const densa = theme.productLayout === "lista-densa";

  return (
    <div ref={raizRef}>
      <div
        ref={barraRef}
        className="sticky top-0 z-20 backdrop-blur-xl"
        style={{
          background: "color-mix(in oklab, var(--menu-bg) 78%, transparent)",
          borderBottom: "1px solid var(--menu-border)",
          paddingTop: "env(safe-area-inset-top)",
        }}
      >
        <div className="mx-auto max-w-6xl">
          {barraSuperior && <div className="px-4 pt-3 lg:pb-3">{barraSuperior}</div>}
          {conNav && (
            <div className="flex items-center lg:hidden">
              <div className="min-w-0 flex-1">
                <CategoryNav theme={theme} categorias={secciones} activa={activa} onSelect={irA} />
              </div>
              <button
                type="button"
                onClick={() => setIndiceAbierto(true)}
                aria-label="Ver todas las categorías"
                className="mr-3 flex h-9 w-9 shrink-0 items-center justify-center transition-transform active:scale-95"
                style={{
                  borderRadius: "9999px",
                  background: "var(--menu-surface)",
                  border: "1px solid var(--menu-border)",
                }}
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 lg:grid lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-10">
        {conNav && (
          <aside className="hidden lg:block">
            <nav
              aria-label="Categorías"
              className="sticky space-y-0.5 pt-6"
              style={{ top: alturaBarra + 8 }}
            >
              <BotonLateral activa={activa === null} onClick={() => irA(null)}>
                Inicio
              </BotonLateral>
              {secciones.map((s) => (
                <BotonLateral
                  key={s.id_categoria}
                  activa={activa === s.id_categoria}
                  onClick={() => irA(s.id_categoria)}
                  total={s.productos.length}
                >
                  <TextoFijo texto={s.nombre} />
                </BotonLateral>
              ))}
            </nav>
          </aside>
        )}

        <div className="min-w-0 pt-6">
          {mostrarPortada && (
            <section aria-label="Categorías" className="mb-10">
              <CategoriaTiles tiles={tiles} onSelect={irA} />
            </section>
          )}

          {secciones.length === 0 ? (
            <p className="py-12 text-center text-sm" style={{ color: "var(--menu-muted)" }}>
              {vacio}
            </p>
          ) : (
            secciones.map((s) => (
              <section
                key={s.id_categoria}
                id={`cat-${s.id_categoria}`}
                aria-labelledby={`cat-titulo-${s.id_categoria}`}
                className="mb-10"
              >
                <header className="mb-4 flex items-end justify-between gap-3">
                  <h2
                    id={`cat-titulo-${s.id_categoria}`}
                    className="text-2xl font-bold leading-none sm:text-3xl"
                    style={{ fontFamily: "var(--menu-heading-font)" }}
                  >
                    <TextoFijo texto={s.nombre} />
                  </h2>
                  <span
                    className="shrink-0 text-sm italic"
                    style={{
                      color: "var(--menu-muted)",
                      fontFamily: "var(--menu-accent-font, var(--menu-body-font))",
                    }}
                  >
                    {s.productos.length} {s.productos.length === 1 ? "opción" : "opciones"}
                  </span>
                </header>
                <div
                  className={GRID[theme.productLayout]}
                  style={densa ? { borderColor: "var(--menu-border)" } : undefined}
                >
                  {s.productos.map((p, i) => (
                    <div
                      key={p.id_producto}
                      className="menu-revelar"
                      style={{ transitionDelay: `${(i % 3) * 60}ms` }}
                    >
                      {renderProducto(p)}
                    </div>
                  ))}
                </div>
              </section>
            ))
          )}
        </div>
      </div>

      {indiceAbierto && (
        <div
          className="fixed inset-0 z-50 lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Categorías"
        >
          <button
            type="button"
            aria-label="Cerrar"
            onClick={() => setIndiceAbierto(false)}
            className="absolute inset-0 animate-in fade-in duration-300"
            style={{ background: "color-mix(in oklab, black 55%, transparent)" }}
          />
          <div
            className="absolute inset-x-0 bottom-0 max-h-[80dvh] overflow-y-auto p-4 pb-[max(1rem,env(safe-area-inset-bottom))] animate-in slide-in-from-bottom duration-300"
            style={{
              background: "var(--menu-bg)",
              borderTopLeftRadius: "calc(var(--menu-radius) + 0.5rem)",
              borderTopRightRadius: "calc(var(--menu-radius) + 0.5rem)",
              borderTop: "1px solid var(--menu-border)",
            }}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-bold" style={{ fontFamily: "var(--menu-heading-font)" }}>
                Categorías
              </h2>
              <button
                type="button"
                aria-label="Cerrar"
                onClick={() => setIndiceAbierto(false)}
                className="flex h-9 w-9 items-center justify-center rounded-full"
                style={{ background: "var(--menu-surface)" }}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <CategoriaTiles tiles={tiles} onSelect={irA} compacto />
          </div>
        </div>
      )}
    </div>
  );
}

function BotonLateral({
  activa,
  onClick,
  total,
  children,
}: {
  activa: boolean;
  onClick: () => void;
  total?: number;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={activa ? "true" : undefined}
      className="flex w-full items-center justify-between gap-2 py-2 pl-3 pr-2 text-left text-sm transition-colors duration-300"
      style={{
        borderLeft: `2px solid ${activa ? "var(--menu-accent)" : "transparent"}`,
        color: activa ? "var(--menu-foreground)" : "var(--menu-muted)",
        fontWeight: activa ? 600 : 500,
      }}
    >
      <span className="min-w-0 truncate">{children}</span>
      {total != null && <span className="shrink-0 text-xs opacity-70">{total}</span>}
    </button>
  );
}

export function BuscadorCarta({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label
      className="flex h-10 items-center gap-2 px-3 lg:mx-auto lg:max-w-md"
      style={{
        background: "var(--menu-surface)",
        border: "1px solid var(--menu-border)",
        borderRadius: "var(--menu-radius)",
      }}
    >
      <Search className="h-4 w-4 shrink-0" style={{ color: "var(--menu-muted)" }} />
      {/* text-base en móvil: con <16px iOS hace zoom al enfocar. */}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Buscar en el menú"
        aria-label="Buscar en el menú"
        className="h-full min-w-0 flex-1 bg-transparent text-base outline-none placeholder:opacity-70 sm:text-sm"
      />
      {value && (
        <button type="button" aria-label="Limpiar búsqueda" onClick={() => onChange("")}>
          <X className="h-4 w-4" style={{ color: "var(--menu-muted)" }} />
        </button>
      )}
    </label>
  );
}
