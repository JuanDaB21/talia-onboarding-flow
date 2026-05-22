import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/bodega/")({
  component: () => <Navigate to="/bodega/proveedores-insumos" replace />,
});
