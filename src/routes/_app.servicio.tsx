import { createFileRoute, Outlet } from "@tanstack/react-router";
import { TurnoGate } from "@/components/turno/turno-gate";
import { AlertasMeseroBanner } from "@/components/servicio/alertas-mesero-banner";

export const Route = createFileRoute("/_app/servicio")({
  component: () => (
    <TurnoGate rolesRequeridos={["MESERO"]}>
      <AlertasMeseroBanner />
      <Outlet />
    </TurnoGate>
  ),
});
