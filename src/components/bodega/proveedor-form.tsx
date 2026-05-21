import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { proveedorSchema, type ProveedorInput } from "@/lib/bodega-schemas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

interface Props {
  idNegocio: string;
  idProveedor?: string;
  initialValues?: ProveedorInput;
  onSuccess: () => void;
  onCancel: () => void;
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
}: Props) {
  const isEdit = Boolean(idProveedor);
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ProveedorInput>({
    resolver: zodResolver(proveedorSchema),
    defaultValues: initialValues ?? EMPTY,
  });

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
          onCheckedChange={(v) => setValue("estado", v)}
        />
      </div>
      <div className="flex gap-2 pt-2">
        <Button type="button" variant="outline" className="flex-1" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" className="flex-1" disabled={isSubmitting}>
          {isSubmitting ? "Guardando…" : isEdit ? "Guardar cambios" : "Guardar"}
        </Button>
      </div>
    </form>
  );
}
