import { memo } from "react";
import { ImageIcon } from "lucide-react";
import type { CartaProducto } from "@/lib/menu-publico.functions";
import { publicUrl } from "@/lib/storage";
import type { MenuTheme } from "@/lib/menu-themes";
import { PriceTag } from "./price-tag";

interface ProductoCardProps {
  p: CartaProducto;
  theme: MenuTheme;
  onClick: () => void;
}

function ProductoCardBase({ p, theme, onClick }: ProductoCardProps) {
  const layout = theme.productLayout;

  if (layout === "hero-grid") {
    return (
      <button
        type="button"
        onClick={onClick}
        className="group text-left overflow-hidden transition-transform active:scale-[0.98]"
        style={{
          background: "var(--menu-surface)",
          borderColor: "var(--menu-border)",
          borderWidth: 1,
          borderStyle: "solid",
          borderRadius: "var(--menu-radius)",
          boxShadow: "var(--menu-shadow, 0 4px 16px -8px rgba(0,0,0,0.15))",
        }}
      >
        <div
          className="aspect-square w-full overflow-hidden flex items-center justify-center"
          style={{ background: "var(--menu-surface-2)" }}
        >
          {p.url_imagen ? (
            <img
              src={publicUrl(p.url_imagen) ?? undefined}
              alt={p.nombre_producto}
              loading="lazy"
              decoding="async"
              width={400}
              height={400}
              className="h-full w-full object-cover transition-transform group-hover:scale-105"
            />
          ) : (
            <ImageIcon className="h-8 w-8" style={{ color: "var(--menu-muted)" }} />
          )}
        </div>
        <div className="p-3 space-y-2">
          <h3
            className="font-bold leading-tight line-clamp-2 text-sm"
            style={{ fontFamily: "var(--menu-heading-font)" }}
          >
            {p.nombre_producto}
          </h3>
          <PriceTag theme={theme} precio={p.precio_venta} />
        </div>
      </button>
    );
  }

  if (layout === "vertical-grande") {
    return (
      <button
        type="button"
        onClick={onClick}
        className="block w-full text-left overflow-hidden transition-transform active:scale-[0.99]"
        style={{
          background: "var(--menu-surface)",
          borderColor: "var(--menu-border)",
          borderWidth: 1,
          borderStyle: "solid",
          borderRadius: "var(--menu-radius)",
          boxShadow: "var(--menu-shadow, 0 4px 14px -8px rgba(0,0,0,0.1))",
        }}
      >
        {p.url_imagen ? (
          <div
            className="h-44 w-full overflow-hidden"
            style={{ background: "var(--menu-surface-2)" }}
          >
            <img
              src={publicUrl(p.url_imagen) ?? undefined}
              alt={p.nombre_producto}
              loading="lazy"
              decoding="async"
              width={800}
              height={352}
              className="h-full w-full object-cover"
            />
          </div>
        ) : (
          <div
            className="h-32 w-full flex items-center justify-center"
            style={{ background: "var(--menu-surface-2)" }}
          >
            <ImageIcon className="h-8 w-8" style={{ color: "var(--menu-muted)" }} />
          </div>
        )}
        <div className="p-4">
          <h3
            className="text-lg font-bold leading-tight"
            style={{ fontFamily: "var(--menu-heading-font)" }}
          >
            {p.nombre_producto}
          </h3>
          {p.descripcion_producto && (
            <p
              className="mt-1 text-sm leading-snug line-clamp-2"
              style={{ color: "var(--menu-muted)" }}
            >
              {p.descripcion_producto}
            </p>
          )}
          <div className="mt-3">
            <PriceTag theme={theme} precio={p.precio_venta} />
          </div>
        </div>
      </button>
    );
  }

  if (layout === "lista-densa") {
    return (
      <button
        type="button"
        onClick={onClick}
        className="flex w-full items-start gap-3 py-3 text-left"
        style={{ borderColor: "var(--menu-border)" }}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-3">
            <h3
              className="font-semibold leading-tight"
              style={{ fontFamily: "var(--menu-heading-font)" }}
            >
              {p.nombre_producto}
            </h3>
            <PriceTag theme={theme} precio={p.precio_venta} />
          </div>
          {p.descripcion_producto && (
            <p className="mt-1 text-xs line-clamp-2" style={{ color: "var(--menu-muted)" }}>
              {p.descripcion_producto}
            </p>
          )}
        </div>
        {p.url_imagen && (
          <div
            className="h-14 w-14 shrink-0 overflow-hidden"
            style={{
              background: "var(--menu-surface-2)",
              borderRadius: "calc(var(--menu-radius) / 1.5)",
            }}
          >
            <img
              src={publicUrl(p.url_imagen) ?? undefined}
              alt={p.nombre_producto}
              loading="lazy"
              decoding="async"
              width={56}
              height={56}
              className="h-full w-full object-cover"
            />
          </div>
        )}
      </button>
    );
  }

  // horizontal (default)
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full gap-3 p-3 text-left transition-transform active:scale-[0.99]"
      style={{
        background: "var(--menu-surface)",
        borderColor: "var(--menu-border)",
        borderWidth: 1,
        borderStyle: "solid",
        borderRadius: "var(--menu-radius)",
        boxShadow: "var(--menu-shadow, 0 2px 10px -6px rgba(0,0,0,0.12))",
      }}
    >
      <div
        className="h-24 w-24 shrink-0 overflow-hidden flex items-center justify-center"
        style={{
          background: "var(--menu-surface-2)",
          borderRadius: "calc(var(--menu-radius) - 4px)",
        }}
      >
        {p.url_imagen ? (
          <img
            src={publicUrl(p.url_imagen) ?? undefined}
            alt={p.nombre_producto}
            loading="lazy"
            decoding="async"
            width={96}
            height={96}
            className="h-full w-full object-cover"
          />
        ) : (
          <ImageIcon className="h-6 w-6" style={{ color: "var(--menu-muted)" }} />
        )}
      </div>
      <div className="min-w-0 flex-1 flex flex-col">
        <h3
          className="font-semibold leading-tight line-clamp-1"
          style={{ fontFamily: "var(--menu-heading-font)" }}
        >
          {p.nombre_producto}
        </h3>
        {p.descripcion_producto && (
          <p className="mt-0.5 text-xs line-clamp-2" style={{ color: "var(--menu-muted)" }}>
            {p.descripcion_producto}
          </p>
        )}
        <div className="mt-auto pt-2">
          <PriceTag theme={theme} precio={p.precio_venta} />
        </div>
      </div>
    </button>
  );
}

export const ProductoCard = memo(ProductoCardBase, (prev, next) => {
  return prev.p === next.p && prev.theme === next.theme && prev.onClick === next.onClick;
});
