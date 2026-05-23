import { createFileRoute } from "@tanstack/react-router";
import { KanbanBoard } from "@/components/preparacion/kanban-board";

export const Route = createFileRoute("/_app/barra")({
  component: BarraPage,
  head: () => ({
    meta: [{ title: "Barra · Talia" }],
  }),
});

function BarraPage() {
  return <KanbanBoard destino="BARRA" titulo="Barra" />;
}
