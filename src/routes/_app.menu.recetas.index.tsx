import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RecetasTable } from "@/components/menu/recetas-table";

export const Route = createFileRoute("/_app/menu/recetas/")({
  head: () => ({ meta: [{ title: "Recetas — Menú" }] }),
  component: RecetasIndex,
});

function RecetasIndex() {
  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Recetas</h1>
          <p className="text-sm text-muted-foreground">
            Cada receta genera automáticamente un producto vendible.
          </p>
        </div>
        <Button asChild size="sm">
          <Link to="/menu/recetas/nueva">
            <Plus className="h-4 w-4 mr-1" /> Nueva receta
          </Link>
        </Button>
      </header>
      <RecetasTable />
    </div>
  );
}
