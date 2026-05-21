import { createFileRoute } from "@tanstack/react-router";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCurrentNegocio } from "@/hooks/use-current-negocio";
import { ProveedoresTab } from "@/components/bodega/proveedores-tab";
import { InsumosTab } from "@/components/bodega/insumos-tab";

export const Route = createFileRoute("/bodega/proveedores-insumos")({
  head: () => ({
    meta: [{ title: "Proveedores e Insumos — Bodega" }],
  }),
  component: ProveedoresInsumosPage,
});

function ProveedoresInsumosPage() {
  const { idNegocio, loading } = useCurrentNegocio();

  if (loading) {
    return <p className="text-sm text-muted-foreground">Cargando…</p>;
  }
  if (!idNegocio) {
    return (
      <p className="text-sm text-destructive">
        No se encontró un negocio asociado a tu usuario.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Proveedores e Insumos</h1>
        <p className="text-sm text-muted-foreground">
          Gestiona a quién le compras y qué productos manejas.
        </p>
      </header>

      <Tabs defaultValue="proveedores" className="w-full">
        <TabsList className="grid w-full max-w-sm grid-cols-2">
          <TabsTrigger value="proveedores">Proveedores</TabsTrigger>
          <TabsTrigger value="insumos">Insumos</TabsTrigger>
        </TabsList>
        <TabsContent value="proveedores" className="mt-4">
          <ProveedoresTab idNegocio={idNegocio} />
        </TabsContent>
        <TabsContent value="insumos" className="mt-4">
          <InsumosTab idNegocio={idNegocio} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
