import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { proveedorSchema, type ProveedorInput } from "@/lib/bodega-schemas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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

interface Props {
  idNegocio: string;
  idProveedor?: string;
  initialValues?: ProveedorInput;
  onSuccess: () => void;
  onCancel: () => void;
  onDelete?: () => void | Promise<void>;
}

const EMPTY: ProveedorInput = {
  razon_social: "",
  documento_tributario: "",
  nombre_contacto: "",
  telefono: "",
  estado: true,
};

export function ProveedorForm({
  idNegocio,
  idProveedor,
  initialValues,
  onSuccess,
  onCancel,
  onDelete,
}: Props) {
  const isEdit = Boolean(idProveedor);
  const [deleting, setDeleting] = useState(false);
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ProveedorInput>({
    resolver: zodResolver(proveedorSchema),
    defaultValues: initialValues ?? EMPTY,
  });

  useEffect(() => {
    reset(initialValues ?? EMPTY);
  }, [initialValues, reset]);

  const estado = watch("estado");

  const onSubmit = async (values: ProveedorInput) => {
    if (isEdit && idProveedor) {
      const { error } = await supabase
        .from("proveedores")
        .update(values)
        .eq("id_proveedor", idProveedor);
      if (error) {
        toast.error("No se pudo actualizar", { description: error.message });
        return;
      }
      toast.success("Proveedor actualizado");
    } else {
      const { error } = await supabase.from("proveedores").insert({
        id_negocio: idNegocio,
        ...values,
      });
      if (error) {
        toast.error("No se pudo crear el proveedor", { description: error.message });
        return;
      }
      toast.success("Proveedor creado");
    }
    onSuccess();
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    setDeleting(true);
    try {
      await onDelete();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="razon_social">Razón social</Label>
        <Input id="razon_social" {...register("razon_social")} />
        {errors.razon_social && (
          <p className="text-xs text-destructive">{errors.razon_social.message}</p>
        )}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="documento_tributario">Documento tributario (NIT / RUT)</Label>
        <Input id="documento_tributario" {...register("documento_tributario")} />
        {errors.documento_tributario && (
          <p className="text-xs text-destructive">{errors.documento_tributario.message}</p>
        )}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="nombre_contacto">Nombre de contacto</Label>
        <Input id="nombre_contacto" {...register("nombre_contacto")} />
        {errors.nombre_contacto && (
          <p className="text-xs text-destructive">{errors.nombre_contacto.message}</p>
        )}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="telefono">Teléfono</Label>
        <Input id="telefono" inputMode="tel" {...register("telefono")} />
        {errors.telefono && (
          <p className="text-xs text-destructive">{errors.telefono.message}</p>
        )}
      </div>
      <div className="flex items-center justify-between rounded-md border p-3">
        <div>
          <Label htmlFor="estado">Estado activo</Label>
          <p className="text-xs text-muted-foreground">Disponible para compras.</p>
        </div>
        <Switch
          id="estado"
          checked={estado}
          onCheckedChange={(v) => setValue("estado", v, { shouldDirty: true })}
        />
      </div>
      <div className="flex flex-col sm:flex-row gap-2 pt-2">
        <Button type="button" variant="outline" className="w-full sm:flex-1" onClick={onCancel}>
          Cancelar
        </Button>
        {isEdit && onDelete && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                type="button"
                variant="destructive"
                className="w-full sm:w-auto"
                disabled={deleting}
              >
                <Trash2 className="h-4 w-4 mr-1" /> Eliminar
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Eliminar proveedor?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta acción no se puede deshacer. El registro será eliminado de forma permanente.
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
        )}
        <Button
          type="submit"
          className="w-full sm:flex-1"
          disabled={isSubmitting || (isEdit && !isDirty)}
        >
          {isSubmitting ? "Guardando…" : isEdit ? "Guardar cambios" : "Guardar"}
        </Button>
      </div>
    </form>
  );
}
