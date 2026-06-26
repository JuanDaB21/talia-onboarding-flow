import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { KanbanBoard } from "@/components/preparacion/kanban-board";
import { TurnoGate } from "@/components/turno/turno-gate";
import { useEspacios } from "@/hooks/use-espacios";

export const Route = createFileRoute("/_app/estacion/$slug")({
  component: EstacionPage,
  head: () => ({ meta: [{ title: "Estación · Talia" }] }),
});

function EstacionPage() {
  const { slug } = Route.useParams();
  const slugUpper = slug.toUpperCase();
  const { espacios, loading } = useEspacios();
  const navigate = useNavigate();
  const espacio = useMemo(
    () => espacios.find((e) => e.slug === slugUpper) ?? null,
    [espacios, slugUpper],
  );

  useEffect(() => {
    if (!loading && espacios.length > 0 && !espacio) {
      navigate({ to: "/" });
    }
  }, [loading, espacios.length, espacio, navigate]);

  if (loading || !espacio) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-sm text-muted-foreground">Cargando…</p>
      </div>
    );
  }

  return (
    <TurnoGate rolesRequeridos={["COCINA", "BARRA", "ESTACION"]} espacioSlug={espacio.slug}>
      <KanbanBoard destino={espacio.slug} titulo={espacio.nombre} />
    </TurnoGate>
  );
}
