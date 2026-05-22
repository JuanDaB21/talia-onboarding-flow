import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/menu")({
  head: () => ({ meta: [{ title: "Menú — Talia" }] }),
  component: () => <Outlet />,
});
