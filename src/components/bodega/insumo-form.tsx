import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Trash2, Warehouse } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { insumoSchema, type InsumoInput } from "@/lib/bodega-schemas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  idInsumo?: string;
  initialValues?: InsumoInput;
  onSuccess: () => void;
  onCancel: () => void;
  onDelete?: () => void | Promise<void>;
}

const EMPTY: InsumoInput = {
  nombre_insumo: "",
  unidad_medida: "",
  costo_promedio: 0,
  stock_minimo: 0,
  unidad_compra: "",
  unidad_receta: "",
  factor_conversion: 1,
};

export function InsumoForm({
  idNegocio,
  idInsumo,
  initialValues,
  onSuccess,
  onCancel,
  onDelete,
}: Props) {
  const isEdit = Boolean(idInsumo);
  const [deleting, setDeleting] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<InsumoInput>({
    resolver: zodResolver(insumoSchema),
    defaultValues: initialValues ?? EMPTY,
  });

  useEffect(() => {
    reset(initialValues ?? EMPTY);
  }, [initialValues, reset]);

  const onSubmit = async (values: InsumoInput) => {
    if (isEdit && idInsumo) {
      const { error } = await supabase
        .from("insumos")
        .update(values)
        .eq("id_insumo", idInsumo);
      if (error) {
        toast.error("No se pudo actualizar", { description: error.message });
        return;
      }
      toast.success("Insumo actualizado");
    } else {
      const { error } = await supabase.from("insumos").insert({
        id_negocio: idNegocio,
        ...values,
      });
      if (error) {
        toast.error("No se pudo crear el insumo", { description: error.message });
        return;
      }
      toast.success("Insumo creado");
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
        <Label htmlFor="nombre_insumo">Nombre del insumo</Label>
        <Input id="nombre_insumo" placeholder="Tomate Chonto" {...register("nombre_insumo")} />
        {errors.nombre_insumo && (
          <p className="text-xs text-destructive">{errors.nombre_insumo.message}</p>
        )}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="unidad_medida">Unidad de medida</Label>
        <Input id="unidad_medida" placeholder="Gramos" {...register("unidad_medida")} />
        {errors.unidad_medida && (
          <p className="text-xs text-destructive">{errors.unidad_medida.message}</p>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="costo_promedio">Costo promedio</Label>
          <Input
            id="costo_promedio"
            type="number"
            step="0.0001"
            {...register("costo_promedio")}
          />
          {errors.costo_promedio && (
            <p className="text-xs text-destructive">{errors.costo_promedio.message}</p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="stock_minimo">Stock mínimo</Label>
          <Input
            id="stock_minimo"
            type="number"
            step="0.0001"
            {...register("stock_minimo")}
          />
          {errors.stock_minimo && (
            <p className="text-xs text-destructive">{errors.stock_minimo.message}</p>
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="unidad_compra">Unidad de compra</Label>
          <Input id="unidad_compra" placeholder="KILOS" {...register("unidad_compra")} />
          {errors.unidad_compra && (
            <p className="text-xs text-destructive">{errors.unidad_compra.message}</p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="unidad_receta">Unidad de receta</Label>
          <Input id="unidad_receta" placeholder="GRAMOS" {...register("unidad_receta")} />
          {errors.unidad_receta && (
            <p className="text-xs text-destructive">{errors.unidad_receta.message}</p>
          )}
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="factor_conversion">Factor de conversión</Label>
        <Input
          id="factor_conversion"
          type="number"
          step="0.0001"
          {...register("factor_conversion")}
        />
        <p className="text-xs text-muted-foreground">
          Cuántas unidades de receta equivalen a una unidad de compra. Ej: 1000 g por kilo.
        </p>
        {errors.factor_conversion && (
          <p className="text-xs text-destructive">{errors.factor_conversion.message}</p>
        )}
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
                <AlertDialogTitle>¿Eliminar insumo?</AlertDialogTitle>
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
