import { useEffect, useMemo, useState } from "react";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { listarProveedores, listarInsumos, registrarCompra } from "@/lib/bodega.functions";
import { fechaLocalISO } from "@/lib/format";
import { useCurrentNegocio } from "@/hooks/use-current-negocio";
import { useBodegas } from "@/hooks/use-bodegas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const itemSchema = z.object({
  id_insumo: z.string().uuid("Selecciona insumo"),
  cantidad: z.coerce.number().gt(0, "> 0"),
  precio_unitario_compra: z.coerce.number().min(0, "≥ 0"),
  id_bodega_destino: z.string().uuid().optional().or(z.literal("")),
});

const compraSchema = z.object({
  id_proveedor: z.string().uuid("Selecciona proveedor"),
  numero_factura: z.string().trim().max(50).optional().or(z.literal("")),
  fecha_compra: z.string().min(1, "Requerido"),
  observaciones: z.string().trim().max(500).optional().or(z.literal("")),
  id_bodega_default: z.string().uuid("Selecciona bodega destino"),
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

interface CompraFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function CompraForm({ onSuccess, onCancel }: CompraFormProps) {
  const { idNegocio, loading: negocioLoading } = useCurrentNegocio();
  const { bodegas, loading: loadingBodegas } = useBodegas({ soloActivas: true });
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [loadingCatalogos, setLoadingCatalogos] = useState(true);

  const today = fechaLocalISO();

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
      id_bodega_default: "",
      items: [{ id_insumo: "", cantidad: 1, precio_unitario_compra: 0, id_bodega_destino: "" }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "items" });

  // Selecciona bodega por defecto cuando carguen
  const bodegaDefault = watch("id_bodega_default");
  useEffect(() => {
    if (!bodegaDefault && bodegas.length > 0) {
      setValue("id_bodega_default", bodegas[0].id_bodega);
    }
  }, [bodegas, bodegaDefault, setValue]);

  useEffect(() => {
    if (!idNegocio) return;
    (async () => {
      setLoadingCatalogos(true);
      const [prov, ins] = await Promise.all([listarProveedores(), listarInsumos()]);
      const provActivos = (prov as unknown as Array<Proveedor & { estado?: boolean }>)
        .filter((p) => p.estado !== false)
        .sort((a, b) => a.razon_social.localeCompare(b.razon_social));
      setProveedores(provActivos);
      setInsumos((ins as unknown as Insumo[]) ?? []);
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
    [proveedores],
  );

  const insumoOpts: ComboboxOption[] = useMemo(
    () =>
      insumos.map((i) => ({
        value: i.id_insumo,
        label: i.nombre_insumo,
        hint: `Compra: ${i.unidad_compra}`,
      })),
    [insumos],
  );

  const items = watch("items");
  const total = useMemo(
    () =>
      items.reduce((acc, it) => {
        const c = Number(it.cantidad) || 0;
        const p = Number(it.precio_unitario_compra) || 0;
        return acc + c * p;
      }, 0),
    [items],
  );

  const onSubmit = async (values: CompraInput) => {
    // No bloqueamos duplicados de insumo: ahora pueden repetirse por bodega distinta
    let idCompra: string;
    try {
      const res = await registrarCompra({
        idProveedor: values.id_proveedor,
        numeroFactura: values.numero_factura || "",
        observaciones: values.observaciones || "",
        fechaCompra: values.fecha_compra,
        idBodegaDefault: values.id_bodega_default,
        items: values.items.map((i) => ({
          id_insumo: i.id_insumo,
          cantidad: Number(i.cantidad),
          precio_unitario_compra: Number(i.precio_unitario_compra),
          id_bodega_destino: i.id_bodega_destino || null,
        })),
      });
      idCompra = res.idCompra;
    } catch (err) {
      toast.error("No se pudo registrar la compra", {
        description: err instanceof Error ? err.message : undefined,
      });
      return;
    }

    toast.success("Compra registrada", {
      description: `ID: ${String(idCompra).slice(0, 8)}…`,
    });
    onSuccess?.();
  };

  if (negocioLoading || loadingCatalogos || loadingBodegas) {
    return <p className="text-sm text-muted-foreground">Cargando catálogos…</p>;
  }

  if (bodegas.length === 0) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Necesitas al menos una bodega activa para registrar compras.
        </p>
        <Button asChild size="sm">
          <Link to="/bodega/bodegas">Ir a Bodegas</Link>
        </Button>
      </div>
    );
  }

  if (proveedores.length === 0) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Necesitas al menos un proveedor activo. Crea uno antes de registrar una compra.
        </p>
        <Button asChild size="sm">
          <Link to="/bodega/proveedores-insumos">Ir a Proveedores</Link>
        </Button>
      </div>
    );
  }

  if (insumos.length === 0) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Necesitas al menos un insumo para registrar una compra.
        </p>
        <Button asChild size="sm">
          <Link to="/bodega/proveedores-insumos">Ir a Insumos</Link>
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {/* Encabezado */}
      <div className="grid gap-3 sm:grid-cols-2">
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
          <Label>Bodega destino (por defecto)</Label>
          <Controller
            control={control}
            name="id_bodega_default"
            render={({ field }) => (
              <Select value={field.value || ""} onValueChange={field.onChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona bodega" />
                </SelectTrigger>
                <SelectContent>
                  {bodegas.map((b) => (
                    <SelectItem key={b.id_bodega} value={b.id_bodega}>
                      {b.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          <p className="text-xs text-muted-foreground">
            Cada línea puede tener una bodega distinta si lo necesitas.
          </p>
          {errors.id_bodega_default && (
            <p className="text-xs text-destructive">{errors.id_bodega_default.message}</p>
          )}
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="observaciones">Observaciones</Label>
          <Textarea id="observaciones" rows={2} {...register("observaciones")} />
        </div>
      </div>

      {/* Detalle */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Detalle</h3>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              append({
                id_insumo: "",
                cantidad: 1,
                precio_unitario_compra: 0,
                id_bodega_destino: "",
              })
            }
          >
            <Plus className="h-4 w-4 mr-1" /> Agregar
          </Button>
        </div>

        {errors.items && typeof errors.items.message === "string" && (
          <p className="text-xs text-destructive">{errors.items.message}</p>
        )}

        <div className="space-y-2">
          {fields.map((field, index) => {
            const row = items[index] ?? {
              cantidad: 0,
              precio_unitario_compra: 0,
              id_bodega_destino: "",
            };
            const subtotal =
              (Number(row.cantidad) || 0) * (Number(row.precio_unitario_compra) || 0);
            const insumoSel = insumos.find((i) => i.id_insumo === row.id_insumo);
            return (
              <Card key={field.id}>
                <CardContent className="pt-4 space-y-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Insumo</Label>
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
                                { shouldDirty: true },
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

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs">
                        Cantidad {insumoSel ? `(${insumoSel.unidad_compra})` : ""}
                      </Label>
                      <Input
                        type="number"
                        step="0.0001"
                        min="0"
                        {...register(`items.${index}.cantidad` as const)}
                      />
                      {errors.items?.[index]?.cantidad && (
                        <p className="text-xs text-destructive">
                          {errors.items[index]?.cantidad?.message}
                        </p>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">V. unitario</Label>
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
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Bodega destino</Label>
                    <Controller
                      control={control}
                      name={`items.${index}.id_bodega_destino` as const}
                      render={({ field: f }) => (
                        <Select
                          value={f.value || "__default"}
                          onValueChange={(v) => f.onChange(v === "__default" ? "" : v)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__default">Usar bodega por defecto</SelectItem>
                            {bodegas.map((b) => (
                              <SelectItem key={b.id_bodega} value={b.id_bodega}>
                                {b.nombre}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <div className="text-xs text-muted-foreground">
                      Subtotal:{" "}
                      <span className="font-medium text-foreground tabular-nums">
                        {subtotal.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </span>
                    </div>
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
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Total */}
      <div className="flex items-center justify-between rounded-md border bg-muted/50 px-4 py-3">
        <span className="text-xs text-muted-foreground">Total factura</span>
        <span className="text-xl font-bold tabular-nums">
          {total.toLocaleString(undefined, { maximumFractionDigits: 2 })}
        </span>
      </div>

      {/* Acciones */}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end pt-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
            Cancelar
          </Button>
        )}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Registrando…" : "Registrar compra"}
        </Button>
      </div>
    </form>
  );
}
