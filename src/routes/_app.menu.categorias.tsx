import { createFileRoute } from "@tanstack/react-router";
import { CategoriasMasterDetail } from "@/components/menu/categorias-master-detail";
import { useCurrentNegocio } from "@/hooks/use-current-negocio";

export const Route = createFileRoute("/_app/menu/categorias")({
  head: () => ({ meta: [{ title: "Categorías — Menú" }] }),
  component: CategoriasPage,
});

function CategoriasPage() {
  const { idNegocio, loading } = useCurrentNegocio();
  if (loading) return <p className="text-sm text-muted-foreground">Cargando…</p>;
  if (!idNegocio) return <p className="text-sm text-destructive">No se encontró un negocio.</p>;
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Categorías y Subcategorías</h1>
        <p className="text-sm text-muted-foreground">
          Organiza tu menú en categorías (ej. Bebidas) y subcategorías (ej. Frías, Calientes).
        </p>
      </header>
      <CategoriasMasterDetail idNegocio={idNegocio} />
    </div>
  );
}
