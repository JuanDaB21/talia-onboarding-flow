import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/configuracion/mesas")({
  head: () => ({ meta: [{ title: "Mesas — Configuración" }] }),
  component: MesasPage,
});

function MesasPage() {
  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-bold">Mesas</h1>
      <p className="text-sm text-muted-foreground">
        Esta sección estará disponible próximamente.
      </p>
    </div>
  );
}
