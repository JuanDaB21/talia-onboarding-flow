import { createFileRoute } from "@tanstack/react-router";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCurrentNegocio } from "@/hooks/use-current-negocio";
import { ProductosTab } from "@/components/menu/productos-tab";
import { ExtrasTab } from "@/components/menu/extras-tab";

export const Route = createFileRoute("/_app/menu/productos")({
  head: () => ({ meta: [{ title: "Productos y Extras — Menú" }] }),
  component: ProductosPage,
});

function ProductosPage() {
  const { idNegocio, loading } = useCurrentNegocio();
  if (loading) return <p className="text-sm text-muted-foreground">Cargando…</p>;
  if (!idNegocio) return <p className="text-sm text-destructive">No se encontró un negocio.</p>;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Productos y Extras</h1>
        <p className="text-sm text-muted-foreground">
          Configura precios, imágenes y extras permitidos para cada producto del menú.
        </p>
      </header>
      <Tabs defaultValue="productos" className="w-full">
        <TabsList className="grid w-full max-w-sm grid-cols-2">
          <TabsTrigger value="productos">Productos</TabsTrigger>
          <TabsTrigger value="extras">Extras</TabsTrigger>
        </TabsList>
        <TabsContent value="productos" className="mt-4">
          <ProductosTab idNegocio={idNegocio} />
        </TabsContent>
        <TabsContent value="extras" className="mt-4">
          <ExtrasTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
