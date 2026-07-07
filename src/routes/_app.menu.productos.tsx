import { createFileRoute } from "@tanstack/react-router";
import { zodValidator } from "@tanstack/zod-adapter";
import { z } from "zod";
import { useCurrentNegocio } from "@/hooks/use-current-negocio";
import { ProductosTab } from "@/components/menu/productos-tab";

const searchSchema = z.object({
  editar: z.string().optional(),
});

export const Route = createFileRoute("/_app/menu/productos")({
  head: () => ({ meta: [{ title: "Productos — Menú" }] }),
  validateSearch: zodValidator(searchSchema),
  component: ProductosPage,
});

function ProductosPage() {
  const { idNegocio, loading } = useCurrentNegocio();
  const { editar: autoEditId } = Route.useSearch();
  if (loading) return <p className="text-sm text-muted-foreground">Cargando…</p>;
  if (!idNegocio) return <p className="text-sm text-destructive">No se encontró un negocio.</p>;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Productos</h1>
        <p className="text-sm text-muted-foreground">
          Configura precios, imágenes y disponibilidad de cada producto del menú.
        </p>
      </header>
      <ProductosTab idNegocio={idNegocio} autoEditId={autoEditId} />
    </div>
  );
}
