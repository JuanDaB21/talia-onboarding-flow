import { ArrowUpRight } from "lucide-react";
import { publicUrl } from "@/lib/storage";
import { TextoFijo } from "@/components/menu-publico/texto-fijo";

export interface TileCategoria {
  id_categoria: string;
  nombre: string;
  /** Foto propia de la categoría o, si no tiene, la del primer producto con foto. */
  imagen: string | null;
  total: number;
}

// Portada de la carta: un tile grande por categoría (patrón stacks.menu). Tocar uno lleva a
// su sección en la misma página. Sin foto, el tile usa el gradiente del tema y la inicial.
export function CategoriaTiles({
  tiles,
  onSelect,
  compacto = false,
}: {
  tiles: TileCategoria[];
  onSelect: (id: string) => void;
  /** Versión del índice (sheet): tiles más bajos, 2 columnas fijas. */
  compacto?: boolean;
}) {
  return (
    <div
      className={
        compacto
          ? "grid grid-cols-2 gap-2.5"
          : "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 lg:gap-4"
      }
    >
      {tiles.map((t, i) => {
        const src = publicUrl(t.imagen);
        return (
          <button
            key={t.id_categoria}
            type="button"
            onClick={() => onSelect(t.id_categoria)}
            className={`menu-tile @container group relative isolate overflow-hidden text-left transition-transform active:scale-[0.98] ${
              compacto ? "aspect-[16/10]" : "aspect-[4/5] sm:aspect-[5/6]"
            } ${compacto ? "" : "menu-revelar"}`}
            style={{
              borderRadius: "var(--menu-radius)",
              border: "1px solid var(--menu-border)",
              background: "var(--menu-gradient, var(--menu-surface-2))",
              boxShadow: "var(--menu-shadow, none)",
              transitionDelay: compacto ? undefined : `${(i % 4) * 70}ms`,
            }}
          >
            {src ? (
              <img
                src={src}
                alt=""
                loading={i < 4 && !compacto ? "eager" : "lazy"}
                decoding="async"
                width={480}
                height={600}
                className="absolute inset-0 -z-10 h-full w-full object-cover"
              />
            ) : (
              <span
                aria-hidden
                className="absolute -right-3 -top-6 -z-10 select-none text-[7rem] font-bold leading-none opacity-20"
                style={{
                  fontFamily: "var(--menu-heading-font)",
                  color: "var(--menu-primary-foreground)",
                }}
              >
                {t.nombre.trim().charAt(0).toUpperCase()}
              </span>
            )}
            <span
              aria-hidden
              className="absolute inset-0 -z-10"
              style={{
                background:
                  "linear-gradient(180deg, transparent 35%, color-mix(in oklab, black 72%, transparent) 100%)",
              }}
            />
            <span className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-3 text-white sm:p-4">
              <span className="min-w-0">
                <span
                  className={`block font-bold leading-[1.05] break-words hyphens-auto ${compacto ? "text-[clamp(0.85rem,9cqi,1.1rem)]" : "text-[clamp(0.95rem,9.5cqi,1.75rem)]"}`}
                  style={{ fontFamily: "var(--menu-heading-font)" }}
                >
                  <TextoFijo texto={t.nombre} />
                </span>
                <span
                  className="mt-0.5 block text-xs opacity-80"
                  style={{ fontFamily: "var(--menu-accent-font, var(--menu-body-font))" }}
                >
                  {t.total} {t.total === 1 ? "opción" : "opciones"}
                </span>
              </span>
              {!compacto && (
                <span
                  aria-hidden
                  className="hidden sm:flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/15 backdrop-blur-sm transition-transform duration-500 group-hover:rotate-45"
                >
                  <ArrowUpRight className="h-4 w-4" />
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
