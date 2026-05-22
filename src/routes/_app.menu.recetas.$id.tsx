import { createFileRoute } from "@tanstack/react-router";
import { RecetaBuilder } from "@/components/menu/receta-builder";
import { useCurrentNegocio } from "@/hooks/use-current-negocio";

export const Route = createFileRoute("/_app/menu/recetas/$id")({
  head: () => ({ meta: [{ title: "Editar receta — Menú" }] }),
  component: EditarRecetaPage,
});

function EditarRecetaPage() {
  const { id } = Route.useParams();
  const { idNegocio, loading } = useCurrentNegocio();
  if (loading) return <p className="text-sm text-muted-foreground">Cargando…</p>;
  if (!idNegocio) return <p className="text-sm text-destructive">No se encontró un negocio.</p>;
  return <RecetaBuilder idNegocio={idNegocio} mode="edit" idReceta={id} />;
}
