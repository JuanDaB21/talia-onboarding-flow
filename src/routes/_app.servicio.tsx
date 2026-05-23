import { createFileRoute, Outlet } from "@tanstack/react-router";
import { TurnoGate } from "@/components/turno/turno-gate";

export const Route = createFileRoute("/_app/servicio")({
  component: () => (
    <TurnoGate rolesRequeridos={["MESERO"]}>
      <Outlet />
    </TurnoGate>
  ),
});
