import { useEffect, useMemo, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Trash2, Warehouse } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { insumoSchema, type InsumoInput } from "@/lib/bodega-schemas";
import {
  UNIDADES,
  getFamilia,
  unidadesDeFamilia,
  unidadBaseDeFamilia,
  calcularFactor,
  requiereFactorManual,
  getUnidad,
  labelDe,
} from "@/lib/unidades";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  costo_promedio: 0,
  stock_minimo: 0,
  unidad_compra: "Kilogramo",
  unidad_receta: "Gramo",
  factor_conversion: 1000,
};

const FAMILIAS = ["PESO", "VOLUMEN", "UNIDAD"] as const;
const FAMILIA_LABEL: Record<(typeof FAMILIAS)[number], string> = {
  PESO: "Peso",
  VOLUMEN: "Volumen",
  UNIDAD: "Unidad",
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
  const navigate = useNavigate();
  const [deleting, setDeleting] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    control,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<InsumoInput>({
    resolver: zodResolver(insumoSchema),
    defaultValues: initialValues ?? EMPTY,
  });

  useEffect(() => {
    reset(initialValues ?? EMPTY);
  }, [initialValues, reset]);

  const unidadCompra = watch("unidad_compra");
  const unidadReceta = watch("unidad_receta");
  const familiaCompra = getFamilia(unidadCompra);

  const recetaOptions = useMemo(
    () => (familiaCompra ? unidadesDeFamilia(familiaCompra) : []),
    [familiaCompra]
  );

  const manual = requiereFactorManual(unidadCompra);
  const factorAuto = !manual ? calcularFactor(unidadCompra, unidadReceta) : null;

  // Si cambia la unidad de compra y la unidad de receta queda fuera de la familia, autosetear.
  useEffect(() => {
    if (!familiaCompra) return;
    const recetaFam = getFamilia(unidadReceta);
    if (recetaFam !== familiaCompra) {
      setValue("unidad_receta", unidadBaseDeFamilia(familiaCompra).code, {
        shouldDirty: true,
        shouldValidate: true,
      });
    }
  }, [familiaCompra, unidadReceta, setValue]);

  // Sincronizar factor automático cuando aplica.
  useEffect(() => {
    if (factorAuto != null) {
      setValue("factor_conversion", factorAuto, {
        shouldDirty: true,
        shouldValidate: true,
      });
      return;
    }
    // Caso manual: si compra = "Unidad" (no manualFactor) y receta = "Unidad" => 1
    const uc = getUnidad(unidadCompra);
    if (uc && !uc.manualFactor && uc.familia === "UNIDAD") {
      setValue("factor_conversion", 1, { shouldDirty: true, shouldValidate: true });
    }
  }, [factorAuto, unidadCompra, setValue]);

  // Prellenar defaultFactor al elegir una unidad manual con sugerencia (ej. Docena = 12)
  useEffect(() => {
    if (!manual) return;
    const uc = getUnidad(unidadCompra);
    if (uc?.defaultFactor) {
      setValue("factor_conversion", uc.defaultFactor, {
        shouldDirty: true,
        shouldValidate: true,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unidadCompra]);

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

  const factorHelp = (() => {
    if (factorAuto != null && unidadCompra && unidadReceta) {
      return `Calculado automáticamente: 1 ${labelDe(unidadCompra)} = ${factorAuto.toLocaleString()} ${labelDe(unidadReceta)}`;
    }
    if (manual) {
      return `¿Cuántas unidades trae 1 ${labelDe(unidadCompra)}? (depende del proveedor)`;
    }
    return "1 unidad de compra equivale a 1 unidad de receta.";
  })();

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="nombre_insumo">Nombre del insumo</Label>
        <Input id="nombre_insumo" placeholder="Tomate Chonto" {...register("nombre_insumo")} />
        {errors.nombre_insumo && (
          <p className="text-xs text-destructive">{errors.nombre_insumo.message}</p>
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

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Unidad de compra</Label>
          <Controller
            control={control}
            name="unidad_compra"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona" />
                </SelectTrigger>
                <SelectContent>
                  {FAMILIAS.map((fam) => (
                    <SelectGroup key={fam}>
                      <SelectLabel>{FAMILIA_LABEL[fam]}</SelectLabel>
                      {UNIDADES.filter((u) => u.familia === fam).map((u) => (
                        <SelectItem key={u.code} value={u.code}>
                          {u.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {errors.unidad_compra && (
            <p className="text-xs text-destructive">{errors.unidad_compra.message}</p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label>Unidad de receta</Label>
          <Controller
            control={control}
            name="unidad_receta"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona" />
                </SelectTrigger>
                <SelectContent>
                  {recetaOptions.map((u) => (
                    <SelectItem key={u.code} value={u.code}>
                      {u.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          <p className="text-xs text-muted-foreground">
            Unidad usada en recetas e inventario.
          </p>
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
          disabled={factorAuto != null}
          {...register("factor_conversion")}
        />
        <p className="text-xs text-muted-foreground">{factorHelp}</p>
        {errors.factor_conversion && (
          <p className="text-xs text-destructive">{errors.factor_conversion.message}</p>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-2 pt-2">
        <Button type="button" variant="outline" className="w-full sm:flex-1" onClick={onCancel}>
          Cancelar
        </Button>
        {isEdit && idInsumo && (
          <Button
            type="button"
            variant="secondary"
            className="w-full sm:w-auto"
            onClick={() => {
              onCancel();
              navigate({ to: "/bodega/inventario/$id", params: { id: idInsumo } });
            }}
          >
            <Warehouse className="h-4 w-4 mr-1" /> Ver en Inventario
          </Button>
        )}
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
