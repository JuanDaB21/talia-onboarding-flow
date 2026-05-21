import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentNegocio } from "@/hooks/use-current-negocio";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ResponsiveSheet } from "@/components/bodega/responsive-sheet";
import { InsumoForm } from "@/components/bodega/insumo-form";
import type { InsumoInput } from "@/lib/bodega-schemas";

export const Route = createFileRoute("/bodega/insumos/$id")({
  head: () => ({ meta: [{ title: "Detalle insumo — Bodega" }] }),
  component: InsumoDetailPage,
});

interface Insumo extends InsumoInput {
  id_insumo: string;
  created_at: string;
}

function fmt(n: number) {
  return Number(n).toLocaleString();
}

function InsumoDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { idNegocio, loading: loadingNegocio } = useCurrentNegocio();
  const [item, setItem] = useState<Insumo | null>(null);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("insumos")
      .select(
        "id_insumo, nombre_insumo, unidad_medida, costo_promedio, stock_minimo, unidad_compra, unidad_receta, factor_conversion, created_at"
      )
      .eq("id_insumo", id)
      .maybeSingle();
    if (error) {
      toast.error("No se pudo cargar el insumo", { description: error.message });
    }
    setItem((data as Insumo) ?? null);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [id]);

  const handleDelete = async () => {
    setDeleting(true);
    const { error } = await supabase.from("insumos").delete().eq("id_insumo", id);
    setDeleting(false);
    if (error) {
      toast.error("No se pudo eliminar", { description: error.message });
      return;
    }
    toast.success("Insumo eliminado");
    navigate({ to: "/bodega/proveedores-insumos" });
  };

  if (loadingNegocio || loading) {
    return <p className="text-sm text-muted-foreground">Cargando…</p>;
  }
  if (!item) {
    return (
      <div className="space-y-3">
        <Link
          to="/bodega/proveedores-insumos"
          className="text-sm text-muted-foreground hover:underline inline-flex items-center gap-1"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Volver
        </Link>
        <p className="text-sm text-destructive">No se encontró el insumo.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between gap-2">
        <Link
          to="/bodega/proveedores-insumos"
          className="text-sm text-muted-foreground hover:underline inline-flex items-center gap-1"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Insumos
        </Link>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
            <Pencil className="h-4 w-4 mr-1" /> Editar
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" variant="destructive">
                <Trash2 className="h-4 w-4 mr-1" /> Eliminar
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Eliminar insumo?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta acción no se puede deshacer. {item.nombre_insumo} será eliminado de forma permanente.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} disabled={deleting}>
                  {deleting ? "Eliminando…" : "Eliminar"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <header className="space-y-1">
        <h1 className="text-2xl font-bold">{item.nombre_insumo}</h1>
        <p className="text-sm text-muted-foreground">
          Creado el {new Date(item.created_at).toLocaleDateString()}
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Medición</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-muted-foreground">Unidad de medida</dt>
                <dd className="font-medium">{item.unidad_medida}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Unidad de compra → receta</dt>
                <dd className="font-medium">
                  {item.unidad_compra} → {item.unidad_receta}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Factor de conversión</dt>
                <dd className="font-medium">{fmt(item.factor_conversion)}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Inventario</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-muted-foreground">Costo promedio</dt>
                <dd className="font-medium">{fmt(item.costo_promedio)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Stock mínimo</dt>
                <dd className="font-medium">
                  {fmt(item.stock_minimo)} {item.unidad_medida}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </div>

      {idNegocio && (
        <ResponsiveSheet
          open={editOpen}
          onOpenChange={setEditOpen}
          title="Editar insumo"
          description="Actualiza los datos del insumo."
        >
          <InsumoForm
            idNegocio={idNegocio}
            idInsumo={item.id_insumo}
            initialValues={{
              nombre_insumo: item.nombre_insumo,
              unidad_medida: item.unidad_medida,
              costo_promedio: item.costo_promedio,
              stock_minimo: item.stock_minimo,
              unidad_compra: item.unidad_compra,
              unidad_receta: item.unidad_receta,
              factor_conversion: item.factor_conversion,
            }}
            onSuccess={() => {
              setEditOpen(false);
              load();
            }}
            onCancel={() => setEditOpen(false)}
          />
        </ResponsiveSheet>
      )}
    </div>
  );
}
