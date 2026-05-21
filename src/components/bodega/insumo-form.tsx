import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { insumoSchema, type InsumoInput } from "@/lib/bodega-schemas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  idNegocio: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export function InsumoForm({ idNegocio, onSuccess, onCancel }: Props) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<InsumoInput>({
    resolver: zodResolver(insumoSchema),
    defaultValues: {
      nombre_insumo: "",
      unidad_medida: "",
      costo_promedio: 0,
      stock_minimo: 0,
      unidad_compra: "",
      unidad_receta: "",
      factor_conversion: 1,
    },
  });

  const onSubmit = async (values: InsumoInput) => {
    const { error } = await supabase.from("insumos").insert({
      id_negocio: idNegocio,
      ...values,
    });
    if (error) {
      toast.error("No se pudo crear el insumo", { description: error.message });
      return;
    }
    toast.success("Insumo creado");
    onSuccess();
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
      <div className="flex gap-2 pt-2">
        <Button type="button" variant="outline" className="flex-1" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" className="flex-1" disabled={isSubmitting}>
          {isSubmitting ? "Guardando…" : "Guardar"}
        </Button>
      </div>
    </form>
  );
}
