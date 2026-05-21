import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/bodega/compras")({
  head: () => ({ meta: [{ title: "Compras — Bodega" }] }),
  component: ComprasPage,
});

function ComprasPage() {
  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-bold">Compras</h1>
      <p className="text-sm text-muted-foreground">
        Próximamente: registro de compras a proveedores y detalle por insumo.
      </p>
    </div>
  );
}
