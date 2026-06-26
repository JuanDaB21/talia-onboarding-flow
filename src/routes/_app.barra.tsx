import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/barra")({
  component: () => <Navigate to="/estacion/$slug" params={{ slug: "BARRA" }} replace />,
});
