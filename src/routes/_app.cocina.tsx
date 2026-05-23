import { createFileRoute } from "@tanstack/react-router";
import { KanbanBoard } from "@/components/preparacion/kanban-board";

export const Route = createFileRoute("/_app/cocina")({
  component: CocinaPage,
  head: () => ({
    meta: [{ title: "Cocina · Talia" }],
  }),
});

function CocinaPage() {
  return <KanbanBoard destino="COCINA" titulo="Cocina" />;
}
