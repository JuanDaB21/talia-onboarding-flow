import { createFileRoute } from "@tanstack/react-router";
import { useCurrentNegocio } from "@/hooks/use-current-negocio";
import { UsuariosTab } from "@/components/configuracion/usuarios-tab";

export const Route = createFileRoute("/_app/configuracion/usuarios")({
  head: () => ({ meta: [{ title: "Usuarios — Configuración" }] }),
  component: UsuariosPage,
});

function UsuariosPage() {
  const { idNegocio, loading } = useCurrentNegocio();

  if (loading) {
    return <p className="text-sm text-muted-foreground">Cargando…</p>;
  }
  if (!idNegocio) {
    return (
      <p className="text-sm text-destructive">No se encontró un negocio asociado a tu usuario.</p>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Usuarios</h1>
        <p className="text-sm text-muted-foreground">
          Gestiona el personal con acceso a tu negocio.
        </p>
      </header>
      <UsuariosTab idNegocio={idNegocio} />
    </div>
  );
}
