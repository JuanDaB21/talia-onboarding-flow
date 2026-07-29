import { createFileRoute } from "@tanstack/react-router";
import { useCurrentNegocio } from "@/hooks/use-current-negocio";
import { MetodosPagoTab } from "@/components/configuracion/metodos-pago-tab";

export const Route = createFileRoute("/_app/configuracion/metodos-pago")({
  head: () => ({ meta: [{ title: "Métodos de pago — Configuración" }] }),
  component: MetodosPagoPage,
});

function MetodosPagoPage() {
  const { idNegocio, loading } = useCurrentNegocio();
  if (loading) return <p className="text-sm text-muted-foreground">Cargando…</p>;
  if (!idNegocio)
    return (
      <p className="text-sm text-destructive">No se encontró un negocio asociado a tu usuario.</p>
    );
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Métodos de pago</h1>
        <p className="text-sm text-muted-foreground">
          Configura los métodos de pago de tu negocio con los nombres que uses. Son los que
          aparecerán al cobrar.
        </p>
      </header>
      <MetodosPagoTab />
    </div>
  );
}
