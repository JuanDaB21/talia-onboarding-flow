import { createFileRoute } from "@tanstack/react-router";
import { InventarioTab } from "@/components/bodega/inventario-tab";

export const Route = createFileRoute("/_app/bodega/inventario")({
  head: () => ({ meta: [{ title: "Inventario — Bodega" }] }),
  component: InventarioPage,
});

function InventarioPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Inventario</h1>
        <p className="text-sm text-muted-foreground">
          Stock actual de cada insumo. Haz clic en una fila para ver detalle e historial.
        </p>
      </header>
      <InventarioTab />
    </div>
  );
}
