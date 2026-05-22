import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/menu/")({
  beforeLoad: () => {
    throw redirect({ to: "/menu/categorias" });
  },
});
