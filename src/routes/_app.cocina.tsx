import { createFileRoute } from "@tanstack/react-router";
import { KanbanBoard } from "@/components/preparacion/kanban-board";
import { TurnoGate } from "@/components/turno/turno-gate";

export const Route = createFileRoute("/_app/cocina")({
  component: CocinaPage,
  head: () => ({
    meta: [{ title: "Cocina · Talia" }],
  }),
});

function CocinaPage() {
  return (
    <TurnoGate rolesRequeridos={["COCINA"]}>
      <KanbanBoard destino="COCINA" titulo="Cocina" />
    </TurnoGate>
  );
}
