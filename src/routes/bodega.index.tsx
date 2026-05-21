import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/bodega/")({
  component: () => <Navigate to="/bodega/proveedores-insumos" replace />,
});
