import { useCallback, useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { AlertTriangle, ArrowLeft, Pencil, SlidersHorizontal } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentNegocio } from "@/hooks/use-current-negocio";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ResponsiveSheet } from "@/components/bodega/responsive-sheet";
import { InsumoForm } from "@/components/bodega/insumo-form";
import { AjustarStockForm } from "@/components/bodega/ajustar-stock-form";
import {
  HistorialComprasTable,
  type HistorialRow,
} from "@/components/bodega/historial-compras-table";
import {
  HistorialMovimientosTable,
  type MovimientoRow,
} from "@/components/bodega/historial-movimientos-table";
import { CompraDetailSheet } from "@/components/bodega/compra-detail-sheet";

export const Route = createFileRoute("/_app/bodega/inventario/$id")({
  head: () => ({ meta: [{ title: "Detalle de inventario — Bodega" }] }),
  component: InventarioDetailPage,
});

interface Insumo {
  id_insumo: string;
  nombre_insumo: string;
  unidad_medida: string;
  costo_promedio: number;
  stock_minimo: number;
  unidad_compra: string;
  unidad_receta: string;
  factor_conversion: number;
}

function InventarioDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { idNegocio, loading: negocioLoading } = useCurrentNegocio();

  const [insumo, setInsumo] = useState<Insumo | null>(null);
  const [cantidad, setCantidad] = useState<number>(0);
  const [historial, setHistorial] = useState<HistorialRow[]>([]);
  const [movimientos, setMovimientos] = useState<MovimientoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingHist, setLoadingHist] = useState(true);
  const [loadingMov, setLoadingMov] = useState(true);

  const [editOpen, setEditOpen] = useState(false);
  const [stockOpen, setStockOpen] = useState(false);
  const [compraSel, setCompraSel] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: ins } = await supabase
      .from("insumos")
      .select(
        "id_insumo, nombre_insumo, unidad_medida, costo_promedio, stock_minimo, unidad_compra, unidad_receta, factor_conversion"
      )
      .eq("id_insumo", id)
      .maybeSingle();
    setInsumo((ins as Insumo) ?? null);

    const { data: inv } = await supabase
      .from("inventario_actual")
      .select("cantidad_actual")
      .eq("id_insumo", id)
      .maybeSingle();
    setCantidad(Number(inv?.cantidad_actual ?? 0));
    setLoading(false);
  }, [id]);

  const loadHistorial = useCallback(async () => {
    setLoadingHist(true);
    const { data } = await supabase
      .from("detalle_compra")
      .select(
        "id_detalle, cantidad, precio_unitario_compra, compras:id_compra!inner(id_compra, fecha_compra, numero_factura, proveedores:id_proveedor(razon_social))"
      )
      .eq("id_insumo", id)
      .order("created_at", { ascending: false });
    const rows = ((data as unknown as HistorialRow[]) ?? []).sort((a, b) => {
      const fa = a.compras?.fecha_compra ?? "";
      const fb = b.compras?.fecha_compra ?? "";
      return fb.localeCompare(fa);
    });
    setHistorial(rows);
    setLoadingHist(false);
  }, [id]);

  const loadMovimientos = useCallback(async () => {
    setLoadingMov(true);
    const { data } = await supabase
      .from("movimientos_inventario")
      .select(
        "id_movimiento, created_at, tipo_movimiento, cantidad, cantidad_anterior, cantidad_nueva, motivo, referencia_id, usuarios_staff:id_usuario(nombre)"
      )
      .eq("id_insumo", id)
      .order("created_at", { ascending: false });
    setMovimientos((data as unknown as MovimientoRow[]) ?? []);
    setLoadingMov(false);
  }, [id]);

  useEffect(() => {
    load();
    loadHistorial();
    loadMovimientos();
  }, [load, loadHistorial, loadMovimientos]);

  useEffect(() => {
    const channel = supabase
      .channel(`mov-insumo-${id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "movimientos_inventario",
          filter: `id_insumo=eq.${id}`,
        },
        () => {
          loadMovimientos();
          load();
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, loadMovimientos, load]);

  if (loading || negocioLoading) {
    return <p className="text-sm text-muted-foreground">Cargando…</p>;
  }
  if (!insumo) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-destructive">Insumo no encontrado.</p>
        <Button asChild variant="outline" size="sm">
          <Link to="/bodega/inventario">Volver al inventario</Link>
        </Button>
      </div>
    );
  }

  const low = cantidad <= Number(insumo.stock_minimo);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate({ to: "/bodega/inventario" })}
        >
          <ArrowLeft className="h-4 w-4 mr-1" /> Inventario
        </Button>
        <span className="text-sm text-muted-foreground">/</span>
        <span className="text-sm font-medium truncate">{insumo.nombre_insumo}</span>
      </div>

      <header className="space-y-1">
        <h1 className="text-2xl font-bold">{insumo.nombre_insumo}</h1>
        <p className="text-sm text-muted-foreground">
          Stock mínimo: {Number(insumo.stock_minimo).toLocaleString()} {insumo.unidad_medida}
        </p>
      </header>

      <section className="rounded-2xl border bg-card p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
              Cantidad disponible
            </p>
            <div className="flex items-baseline gap-3">
              <span className="text-6xl sm:text-7xl font-bold tabular-nums leading-none">
                {cantidad.toLocaleString()}
              </span>
              <span className="text-2xl text-muted-foreground">{insumo.unidad_medida}</span>
            </div>
            {low && (
              <Badge variant="destructive" className="mt-3 gap-1">
                <AlertTriangle className="h-3 w-3" /> Stock bajo
              </Badge>
            )}
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setEditOpen(true)}>
              <Pencil className="h-4 w-4 mr-1" /> Editar insumo
            </Button>
            <Button onClick={() => setStockOpen(true)}>
              <SlidersHorizontal className="h-4 w-4 mr-1" /> Modificar stock
            </Button>
          </div>
        </div>
      </section>

      <Tabs defaultValue="movimientos" className="space-y-4">
        <TabsList>
          <TabsTrigger value="movimientos">Historial de movimientos</TabsTrigger>
          <TabsTrigger value="compras">Historial de compras</TabsTrigger>
        </TabsList>
        <TabsContent value="movimientos" className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Entradas, salidas y ajustes de este insumo.
          </p>
          <HistorialMovimientosTable
            rows={movimientos}
            loading={loadingMov}
            unidad={insumo.unidad_medida}
            onSelectCompra={(idCompra) => setCompraSel(idCompra)}
          />
        </TabsContent>
        <TabsContent value="compras" className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Compras de este insumo a distintos proveedores.
          </p>
          <HistorialComprasTable
            rows={historial}
            loading={loadingHist}
            onSelect={(idCompra) => setCompraSel(idCompra)}
          />
        </TabsContent>
      </Tabs>

      {/* Editar insumo */}
      <ResponsiveSheet
        open={editOpen}
        onOpenChange={setEditOpen}
        title="Editar insumo"
        description="Actualiza los datos del insumo."
      >
        {idNegocio && (
          <InsumoForm
            key={insumo.id_insumo}
            idNegocio={idNegocio}
            idInsumo={insumo.id_insumo}
            initialValues={{
              nombre_insumo: insumo.nombre_insumo,
              unidad_medida: insumo.unidad_medida,
              costo_promedio: insumo.costo_promedio,
              stock_minimo: insumo.stock_minimo,
              unidad_compra: insumo.unidad_compra,
              unidad_receta: insumo.unidad_receta,
              factor_conversion: insumo.factor_conversion,
            }}
            onSuccess={() => {
              setEditOpen(false);
              load();
            }}
            onCancel={() => setEditOpen(false)}
            onDelete={async () => {
              const { error } = await supabase
                .from("insumos")
                .delete()
                .eq("id_insumo", insumo.id_insumo);
              if (error) {
                toast.error("No se pudo eliminar", { description: error.message });
                return;
              }
              toast.success("Insumo eliminado");
              navigate({ to: "/bodega/inventario" });
            }}
          />
        )}
      </ResponsiveSheet>

      {/* Modificar stock */}
      <ResponsiveSheet
        open={stockOpen}
        onOpenChange={setStockOpen}
        title="Modificar stock actual"
        description="Registra un ajuste manual del inventario."
      >
        <AjustarStockForm
          idInsumo={insumo.id_insumo}
          cantidadActual={cantidad}
          unidadMedida={insumo.unidad_medida}
          onSuccess={() => {
            setStockOpen(false);
            load();
          }}
          onCancel={() => setStockOpen(false)}
        />
      </ResponsiveSheet>

      {/* Detalle de compra (nivel final) */}
      <CompraDetailSheet
        idCompra={compraSel}
        open={Boolean(compraSel)}
        onOpenChange={(o) => !o && setCompraSel(null)}
      />
    </div>
  );
}
