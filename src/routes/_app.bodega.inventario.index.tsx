import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { InventarioTab } from "@/components/bodega/inventario-tab";
import { HistorialInventarioTab } from "@/components/bodega/historial-inventario-tab";

const searchSchema = z.object({
  tab: fallback(z.enum(["stock", "historial"]), "stock").default("stock"),
});

export const Route = createFileRoute("/_app/bodega/inventario/")({
  head: () => ({ meta: [{ title: "Inventario — Bodega" }] }),
  validateSearch: zodValidator(searchSchema),
  component: InventarioPage,
});

function InventarioPage() {
  const { tab } = Route.useSearch();
  const navigate = useNavigate({ from: "/bodega/inventario" });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Inventario</h1>
        <p className="text-sm text-muted-foreground">
          Consulta el stock actual o revisa todos los movimientos del inventario.
        </p>
      </header>

      <Tabs
        value={tab}
        onValueChange={(v) =>
          navigate({
            search: (prev: { tab: "stock" | "historial" }) => ({
              ...prev,
              tab: v as "stock" | "historial",
            }),
          })
        }
        className="space-y-4"
      >
        <TabsList>
          <TabsTrigger value="stock">Stock</TabsTrigger>
          <TabsTrigger value="historial">Historial</TabsTrigger>
        </TabsList>
        <TabsContent value="stock">
          <InventarioTab />
        </TabsContent>
        <TabsContent value="historial">
          <HistorialInventarioTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
