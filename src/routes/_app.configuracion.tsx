import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/configuracion")({
  head: () => ({
    meta: [{ title: "Configuración — Talia" }],
  }),
  component: () => <Outlet />,
});
