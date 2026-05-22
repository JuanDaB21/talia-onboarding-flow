import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/menu/recetas")({
  head: () => ({ meta: [{ title: "Recetas — Menú" }] }),
  component: () => <Outlet />,
});
