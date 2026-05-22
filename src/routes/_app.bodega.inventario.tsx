import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/bodega/inventario")({
  head: () => ({ meta: [{ title: "Inventario — Bodega" }] }),
  component: () => <Outlet />,
});
