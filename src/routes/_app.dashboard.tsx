import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/dashboard")({
  head: () => ({
    meta: [{ title: "Dashboard — Talia" }],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
      <p className="text-sm text-muted-foreground">
        Próximamente verás aquí un resumen de tu operación.
      </p>
    </div>
  );
}
