import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/bodega/inventario")({
  head: () => ({ meta: [{ title: "Inventario — Bodega" }] }),
  component: InventarioPage,
});

function InventarioPage() {
  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-bold">Inventario</h1>
      <p className="text-sm text-muted-foreground">
        Próximamente: stock actual, movimientos y alertas de reposición.
      </p>
    </div>
  );
}
