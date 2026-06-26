import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeft, Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { ResponsiveSheet } from "@/components/ui/responsive-sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useEspacios } from "@/hooks/use-espacios";
import {
  crearEspacio,
  renombrarEspacio,
  toggleEspacio,
  eliminarEspacio,
  type EspacioTrabajo,
} from "@/lib/espacios.functions";

export const Route = createFileRoute("/_app/configuracion/espacios")({
  head: () => ({ meta: [{ title: "Espacios de trabajo · Talia" }] }),
  component: EspaciosPage,
});

function EspaciosPage() {
  const { espacios, loading, invalidate } = useEspacios();
  const crear = useServerFn(crearEspacio);
  const renombrar = useServerFn(renombrarEspacio);
  const toggle = useServerFn(toggleEspacio);
  const eliminar = useServerFn(eliminarEspacio);

  const [sheet, setSheet] = useState<{ open: boolean; editing?: EspacioTrabajo }>({ open: false });
  const [delTarget, setDelTarget] = useState<EspacioTrabajo | null>(null);
  const [nombre, setNombre] = useState("");
  const [saving, setSaving] = useState(false);

  const openCreate = () => {
    setNombre("");
    setSheet({ open: true });
  };
  const openEdit = (e: EspacioTrabajo) => {
    setNombre(e.nombre);
    setSheet({ open: true, editing: e });
  };

  const handleSave = async () => {
    if (nombre.trim().length < 2) {
      toast.error("Nombre muy corto");
      return;
    }
    setSaving(true);
    try {
      if (sheet.editing) {
        await renombrar({ data: { id_espacio: sheet.editing.id_espacio, nombre: nombre.trim() } });
        toast.success("Espacio actualizado");
      } else {
        await crear({ data: { nombre: nombre.trim() } });
        toast.success("Espacio creado");
      }
      setSheet({ open: false });
      await invalidate();
    } catch (e) {
      toast.error("No se pudo guardar", { description: (e as Error).message });
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (esp: EspacioTrabajo, activo: boolean) => {
    try {
      await toggle({ data: { id_espacio: esp.id_espacio, activo } });
      await invalidate();
    } catch (e) {
      toast.error("No se pudo cambiar", { description: (e as Error).message });
    }
  };

  const handleDelete = async () => {
    if (!delTarget) return;
    try {
      await eliminar({ data: { id_espacio: delTarget.id_espacio } });
      toast.success("Espacio eliminado");
      setDelTarget(null);
      await invalidate();
    } catch (e) {
      toast.error("No se pudo eliminar", { description: (e as Error).message });
    }
  };

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-4 max-w-3xl">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/configuracion">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold tracking-tight">Espacios de trabajo</h1>
          <p className="text-sm text-muted-foreground">
            Define dónde se preparan tus productos (cocina, barra, plancha, postres…).
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" /> Nuevo
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : (
        <div className="space-y-2">
          {espacios.map((e) => (
            <Card key={e.id_espacio} className="flex items-center gap-3 p-3">
              <div className="flex-1 min-w-0">
                <p className="font-medium">
                  {e.nombre}
                  {e.es_sistema && (
                    <span className="ml-2 text-xs text-muted-foreground">(sistema)</span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground font-mono">{e.slug}</p>
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor={`toggle-${e.id_espacio}`} className="text-xs">
                  {e.activo ? "Activo" : "Inactivo"}
                </Label>
                <Switch
                  id={`toggle-${e.id_espacio}`}
                  checked={e.activo}
                  onCheckedChange={(v) => handleToggle(e, v)}
                />
              </div>
              <Button size="icon" variant="ghost" onClick={() => openEdit(e)}>
                <Pencil className="h-4 w-4" />
              </Button>
              {!e.es_sistema && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="text-destructive"
                  onClick={() => setDelTarget(e)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </Card>
          ))}
        </div>
      )}

      <ResponsiveSheet
        open={sheet.open}
        onOpenChange={(o) => setSheet({ open: o, editing: o ? sheet.editing : undefined })}
        title={sheet.editing ? "Editar espacio" : "Nuevo espacio"}
      >
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="nombre">Nombre</Label>
            <Input
              id="nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej. Plancha, Postres, Bar de jugos"
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              Se usará como destino para categorías, comandas y roles.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => setSheet({ open: false })}
            >
              Cancelar
            </Button>
            <Button type="button" className="flex-1" onClick={handleSave} disabled={saving}>
              {saving ? "Guardando…" : "Guardar"}
            </Button>
          </div>
        </div>
      </ResponsiveSheet>

      <AlertDialog open={!!delTarget} onOpenChange={(o) => !o && setDelTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar espacio?</AlertDialogTitle>
            <AlertDialogDescription>
              Si tiene categorías asociadas no se podrá eliminar. En ese caso, desactívalo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
