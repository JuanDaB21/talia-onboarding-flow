import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/cocina")({
  component: () => <Navigate to="/estacion/$slug" params={{ slug: "COCINA" }} replace />,
});
