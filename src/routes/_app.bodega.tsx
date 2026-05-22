import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/bodega")({
  head: () => ({
    meta: [{ title: "Bodega — Talia" }],
  }),
  component: () => <Outlet />,
});
