import { memo } from "react";
import type { MenuTheme } from "@/lib/menu-themes";

const fmt = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

function PriceTagBase({ theme, precio }: { theme: MenuTheme; precio: number }) {
  const style = theme.priceStyle;
  const formatted = fmt.format(precio);

  if (style === "tag") {
    return (
      <span
        className="inline-block px-2.5 py-1 text-sm font-bold tabular-nums"
        style={{
          background: "var(--menu-accent)",
          color: "var(--menu-primary-foreground)",
          borderRadius: "calc(var(--menu-radius) / 2)",
        }}
      >
        {formatted}
      </span>
    );
  }

  if (style === "badge-gradiente") {
    return (
      <span
        className="inline-block px-3 py-1.5 text-sm font-extrabold tabular-nums"
        style={{
          background: theme.vars["--menu-gradient"] ?? "var(--menu-primary)",
          color: "var(--menu-primary-foreground)",
          borderRadius: "9999px",
          boxShadow: "var(--menu-shadow, none)",
        }}
      >
        {formatted}
      </span>
    );
  }

  if (style === "linea") {
    return (
      <span className="inline-flex items-center gap-2 text-sm font-semibold tabular-nums">
        <span className="h-px w-6" style={{ background: "var(--menu-accent)" }} />
        <span style={{ color: "var(--menu-accent)" }}>{formatted}</span>
      </span>
    );
  }

  if (style === "subrayado") {
    return (
      <span
        className="text-sm font-bold tabular-nums"
        style={{
          color: "var(--menu-accent)",
          borderBottom: "2px solid var(--menu-accent)",
          paddingBottom: 1,
        }}
      >
        {formatted}
      </span>
    );
  }

  return (
    <span
      className="text-sm font-semibold tabular-nums"
      style={{ color: "var(--menu-foreground)" }}
    >
      {formatted}
    </span>
  );
}

export const PriceTag = memo(PriceTagBase);
