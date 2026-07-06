import { createFileRoute } from "@tanstack/react-router";
import { useCurrentNegocio } from "@/hooks/use-current-negocio";
import { MesasTab } from "@/components/configuracion/mesas/mesas-tab";

export const Route = createFileRoute("/_app/configuracion/mesas")({
  head: () => ({ meta: [{ title: "Mesas — Configuración" }] }),
  component: MesasPage,
});

function MesasPage() {
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
        <h1 className="text-2xl font-bold">Mesas</h1>
        <p className="text-sm text-muted-foreground">
          Crea mesas y comparte sus códigos QR con los clientes.
        </p>
      </header>
      <MesasTab idNegocio={idNegocio} />
    </div>
  );
}
