import { createFileRoute } from "@tanstack/react-router";
import { KanbanBoard } from "@/components/preparacion/kanban-board";
import { TurnoGate } from "@/components/turno/turno-gate";

export const Route = createFileRoute("/_app/barra")({
  component: BarraPage,
  head: () => ({
    meta: [{ title: "Barra · Talia" }],
  }),
});

function BarraPage() {
  return (
    <TurnoGate rolesRequeridos={["BARRA"]}>
      <KanbanBoard destino="BARRA" titulo="Barra" />
    </TurnoGate>
  );
}
