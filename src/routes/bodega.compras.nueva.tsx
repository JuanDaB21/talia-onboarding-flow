import { useEffect, useMemo, useState } from "react";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Plus, Trash2, ArrowLeft } from "lucide-react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentNegocio } from "@/hooks/use-current-negocio";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Combobox, type ComboboxOption } from "@/components/bodega/combobox";

export const Route = createFileRoute("/bodega/compras/nueva")({
  head: () => ({ meta: [{ title: "Registrar compra — Bodega" }] }),
  component: NuevaCompraPage,
});

const itemSchema = z.object({
  id_insumo: z.string().uuid("Selecciona insumo"),
  cantidad: z.coerce.number().gt(0, "> 0"),
  precio_unitario_compra: z.coerce.number().min(0, "≥ 0"),
});

const compraSchema = z.object({
  id_proveedor: z.string().uuid("Selecciona proveedor"),
  numero_factura: z.string().trim().max(50).optional().or(z.literal("")),
  fecha_compra: z.string().min(1, "Requerido"),
  observaciones: z.string().trim().max(500).optional().or(z.literal("")),
  items: z.array(itemSchema).min(1, "Agrega al menos un insumo"),
});

type CompraInput = z.infer<typeof compraSchema>;

interface Proveedor {
  id_proveedor: string;
  razon_social: string;
  documento_tributario: string;
}
interface Insumo {
  id_insumo: string;
  nombre_insumo: string;
  unidad_compra: string;
  costo_promedio: number;
}

function NuevaCompraPage() {
  const navigate = useNavigate();
  const { idNegocio, loading: negocioLoading } = useCurrentNegocio();
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [loadingCatalogos, setLoadingCatalogos] = useState(true);

  const today = new Date().toISOString().slice(0, 10);

  const {
    control,
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CompraInput>({
    resolver: zodResolver(compraSchema),
    defaultValues: {
      id_proveedor: "",
      numero_factura: "",
      fecha_compra: today,
      observaciones: "",
      items: [{ id_insumo: "", cantidad: 1, precio_unitario_compra: 0 }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "items" });

  useEffect(() => {
    if (!idNegocio) return;
    (async () => {
      setLoadingCatalogos(true);
      const [{ data: prov }, { data: ins }] = await Promise.all([
        supabase
          .from("proveedores")
          .select("id_proveedor, razon_social, documento_tributario")
          .eq("id_negocio", idNegocio)
          .eq("estado", true)
          .order("razon_social"),
        supabase
          .from("insumos")
          .select("id_insumo, nombre_insumo, unidad_compra, costo_promedio")
          .eq("id_negocio", idNegocio)
          .order("nombre_insumo"),
      ]);
      setProveedores(prov ?? []);
      setInsumos((ins ?? []) as Insumo[]);
      setLoadingCatalogos(false);
    })();
  }, [idNegocio]);

  const proveedorOpts: ComboboxOption[] = useMemo(
    () =>
      proveedores.map((p) => ({
        value: p.id_proveedor,
        label: p.razon_social,
        hint: p.documento_tributario,
      })),
    [proveedores]
  );

  const insumoOpts: ComboboxOption[] = useMemo(
    () =>
      insumos.map((i) => ({
        value: i.id_insumo,
        label: i.nombre_insumo,
        hint: `Compra: ${i.unidad_compra}`,
      })),
    [insumos]
  );

  const items = watch("items");
  const total = useMemo(
    () =>
      items.reduce((acc, it) => {
        const c = Number(it.cantidad) || 0;
        const p = Number(it.precio_unitario_compra) || 0;
        return acc + c * p;
      }, 0),
    [items]
  );

  const onSubmit = async (values: CompraInput) => {
    // Duplicate insumo check
    const ids = values.items.map((i) => i.id_insumo);
    if (new Set(ids).size !== ids.length) {
      toast.error("No repitas el mismo insumo en líneas distintas");
      return;
    }

    const { data, error } = await supabase.rpc("registrar_compra" as never, {
      p_id_proveedor: values.id_proveedor,
      p_numero_factura: values.numero_factura || "",
      p_observaciones: values.observaciones || "",
      p_fecha_compra: values.fecha_compra,
      p_items: values.items.map((i) => ({
        id_insumo: i.id_insumo,
        cantidad: Number(i.cantidad),
        precio_unitario_compra: Number(i.precio_unitario_compra),
      })),
    } as never);

    if (error) {
      toast.error("No se pudo registrar la compra", { description: error.message });
      return;
    }

    toast.success("Compra registrada", {
      description: `ID: ${String(data).slice(0, 8)}…`,
    });
    navigate({ to: "/bodega/compras" });
  };

  if (negocioLoading || loadingCatalogos) {
    return <p className="text-sm text-muted-foreground">Cargando catálogos…</p>;
  }

  if (proveedores.length === 0) {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-bold">Registrar compra</h1>
        <p className="text-sm text-muted-foreground">
          Necesitas al menos un proveedor activo. Crea uno antes de registrar una compra.
        </p>
        <Button asChild>
          <Link to="/bodega/proveedores-insumos">Ir a Proveedores</Link>
        </Button>
      </div>
    );
  }

  if (insumos.length === 0) {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-bold">Registrar compra</h1>
        <p className="text-sm text-muted-foreground">
          Necesitas al menos un insumo para registrar una compra.
        </p>
        <Button asChild>
          <Link to="/bodega/proveedores-insumos">Ir a Insumos</Link>
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => navigate({ to: "/bodega/compras" })}
          aria-label="Volver"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold">Registrar compra</h1>
      </div>

      {/* Encabezado */}
      <Card>
        <CardContent className="pt-6 grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Proveedor</Label>
            <Controller
              control={control}
              name="id_proveedor"
              render={({ field }) => (
                <Combobox
                  options={proveedorOpts}
                  value={field.value || null}
                  onChange={field.onChange}
                  placeholder="Selecciona proveedor"
                  searchPlaceholder="Buscar proveedor…"
                />
              )}
            />
            {errors.id_proveedor && (
              <p className="text-xs text-destructive">{errors.id_proveedor.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="numero_factura">N.º de factura</Label>
            <Input id="numero_factura" placeholder="F-0001" {...register("numero_factura")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fecha_compra">Fecha</Label>
            <Input id="fecha_compra" type="date" {...register("fecha_compra")} />
            {errors.fecha_compra && (
              <p className="text-xs text-destructive">{errors.fecha_compra.message}</p>
            )}
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="observaciones">Observaciones</Label>
            <Textarea id="observaciones" rows={2} {...register("observaciones")} />
          </div>
        </CardContent>
      </Card>

      {/* Detalle */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Detalle</h2>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              append({ id_insumo: "", cantidad: 1, precio_unitario_compra: 0 })
            }
          >
            <Plus className="h-4 w-4 mr-1" /> Agregar insumo
          </Button>
        </div>

        {errors.items && typeof errors.items.message === "string" && (
          <p className="text-xs text-destructive">{errors.items.message}</p>
        )}

        <div className="space-y-3">
          {fields.map((field, index) => {
            const row = items[index] ?? { cantidad: 0, precio_unitario_compra: 0 };
            const subtotal =
              (Number(row.cantidad) || 0) * (Number(row.precio_unitario_compra) || 0);
            const insumoSel = insumos.find((i) => i.id_insumo === row.id_insumo);
            return (
              <Card key={field.id}>
                <CardContent className="pt-4 space-y-3">
                  <div className="grid gap-3 md:grid-cols-[1fr_120px_140px_140px_auto] md:items-end">
                    <div className="space-y-1.5">
                      <Label className="md:hidden">Insumo</Label>
                      <Label className="hidden md:block">
                        {index === 0 ? "Insumo" : <span className="invisible">.</span>}
                      </Label>
                      <Controller
                        control={control}
                        name={`items.${index}.id_insumo` as const}
                        render={({ field: f }) => (
                          <Combobox
                            options={insumoOpts}
                            value={f.value || null}
                            onChange={(v) => {
                              f.onChange(v);
                              const ins = insumos.find((x) => x.id_insumo === v);
                              if (
                                ins &&
                                (!row.precio_unitario_compra ||
                                  Number(row.precio_unitario_compra) === 0)
                              ) {
                                setValue(
                                  `items.${index}.precio_unitario_compra`,
                                  Number(ins.costo_promedio) || 0,
                                  { shouldDirty: true }
                                );
                              }
                            }}
                            placeholder="Selecciona insumo"
                            searchPlaceholder="Buscar insumo…"
                          />
                        )}
                      />
                      {errors.items?.[index]?.id_insumo && (
                        <p className="text-xs text-destructive">
                          {errors.items[index]?.id_insumo?.message}
                        </p>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <Label className="md:hidden">Cantidad</Label>
                      <Label className="hidden md:block">
                        {index === 0 ? "Cantidad" : <span className="invisible">.</span>}
                      </Label>
                      <Input
                        type="number"
                        step="0.0001"
                        min="0"
                        {...register(`items.${index}.cantidad` as const)}
                      />
                      {insumoSel && (
                        <p className="text-[10px] text-muted-foreground">
                          {insumoSel.unidad_compra}
                        </p>
                      )}
                      {errors.items?.[index]?.cantidad && (
                        <p className="text-xs text-destructive">
                          {errors.items[index]?.cantidad?.message}
                        </p>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <Label className="md:hidden">V. unitario</Label>
                      <Label className="hidden md:block">
                        {index === 0 ? "V. unitario" : <span className="invisible">.</span>}
                      </Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        {...register(`items.${index}.precio_unitario_compra` as const)}
                      />
                      {errors.items?.[index]?.precio_unitario_compra && (
                        <p className="text-xs text-destructive">
                          {errors.items[index]?.precio_unitario_compra?.message}
                        </p>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <Label className="md:hidden">Subtotal</Label>
                      <Label className="hidden md:block">
                        {index === 0 ? "Subtotal" : <span className="invisible">.</span>}
                      </Label>
                      <div className="h-9 flex items-center justify-end px-3 rounded-md bg-muted/50 tabular-nums text-sm font-medium">
                        {subtotal.toLocaleString()}
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => remove(index)}
                        disabled={fields.length === 1}
                        aria-label="Eliminar línea"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Total + acciones */}
      <Card>
        <CardContent className="pt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs text-muted-foreground">Total factura</p>
            <p className="text-3xl font-bold tabular-nums">
              {total.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate({ to: "/bodega/compras" })}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Registrando…" : "Registrar compra"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}
