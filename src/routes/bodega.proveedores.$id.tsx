import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentNegocio } from "@/hooks/use-current-negocio";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { ProveedorForm } from "@/components/bodega/proveedor-form";
import type { ProveedorInput } from "@/lib/bodega-schemas";

export const Route = createFileRoute("/bodega/proveedores/$id")({
  head: () => ({ meta: [{ title: "Detalle proveedor — Bodega" }] }),
  component: ProveedorDetailPage,
});

interface Proveedor extends ProveedorInput {
  id_proveedor: string;
  created_at: string;
}

function ProveedorDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { idNegocio, loading: loadingNegocio } = useCurrentNegocio();
  const [item, setItem] = useState<Proveedor | null>(null);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("proveedores")
      .select(
        "id_proveedor, razon_social, documento_tributario, nombre_contacto, telefono, estado, created_at"
      )
      .eq("id_proveedor", id)
      .maybeSingle();
    if (error) {
      toast.error("No se pudo cargar el proveedor", { description: error.message });
    }
    setItem((data as Proveedor) ?? null);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [id]);

  const handleDelete = async () => {
    setDeleting(true);
    const { error } = await supabase
      .from("proveedores")
      .delete()
      .eq("id_proveedor", id);
    setDeleting(false);
    if (error) {
      toast.error("No se pudo eliminar", { description: error.message });
      return;
    }
    toast.success("Proveedor eliminado");
    navigate({ to: "/bodega/proveedores-insumos" });
  };

  if (loadingNegocio || loading) {
    return <p className="text-sm text-muted-foreground">Cargando…</p>;
  }
  if (!item) {
    return (
      <div className="space-y-3">
        <Link to="/bodega/proveedores-insumos" className="text-sm text-muted-foreground hover:underline inline-flex items-center gap-1">
          <ArrowLeft className="h-3.5 w-3.5" /> Volver
        </Link>
        <p className="text-sm text-destructive">No se encontró el proveedor.</p>
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
          <ArrowLeft className="h-3.5 w-3.5" /> Proveedores
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
                <AlertDialogTitle>¿Eliminar proveedor?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta acción no se puede deshacer. El registro de {item.razon_social} será eliminado de forma permanente.
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
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-2xl font-bold">{item.razon_social}</h1>
          <Badge variant={item.estado ? "default" : "secondary"}>
            {item.estado ? "Activo" : "Inactivo"}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Creado el {new Date(item.created_at).toLocaleDateString()}
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Información del proveedor</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-muted-foreground">Documento tributario</dt>
              <dd className="font-medium">{item.documento_tributario}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Contacto</dt>
              <dd className="font-medium">{item.nombre_contacto}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Teléfono</dt>
              <dd className="font-medium">{item.telefono}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Estado</dt>
              <dd className="font-medium">{item.estado ? "Activo" : "Inactivo"}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      {idNegocio && (
        <ResponsiveSheet
          open={editOpen}
          onOpenChange={setEditOpen}
          title="Editar proveedor"
          description="Actualiza los datos del proveedor."
        >
          <ProveedorForm
            idNegocio={idNegocio}
            idProveedor={item.id_proveedor}
            initialValues={{
              razon_social: item.razon_social,
              documento_tributario: item.documento_tributario,
              nombre_contacto: item.nombre_contacto,
              telefono: item.telefono,
              estado: item.estado,
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
