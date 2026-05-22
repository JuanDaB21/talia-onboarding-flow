import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { productoSchema, type ProductoInput } from "@/lib/menu-schemas";
import type { Producto } from "./productos-tab";

interface Insumo { id_insumo: string; nombre_insumo: string; unidad_receta: string }

interface ExtraState {
  id_insumo_extra: string;
  cantidad_porcion: number;
  precio_extra: number;
}

export function ProductoForm({
  producto, onSuccess, onCancel,
}: { idNegocio: string; producto: Producto; onSuccess: () => void; onCancel: () => void }) {
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [extras, setExtras] = useState<Record<string, ExtraState>>({});
  const [loadingExtras, setLoadingExtras] = useState(true);

  const { register, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } =
    useForm<ProductoInput>({
      resolver: zodResolver(productoSchema),
      defaultValues: {
        descripcion_producto: producto.descripcion_producto ?? "",
        precio_venta: Number(producto.precio_venta),
        url_imagen: producto.url_imagen ?? "",
        activo: producto.activo,
      },
    });

  useEffect(() => {
    (async () => {
      setLoadingExtras(true);
      const [{ data: ins }, { data: exs }] = await Promise.all([
        supabase.from("insumos").select("id_insumo, nombre_insumo, unidad_receta").order("nombre_insumo"),
        supabase.from("extras_permitidos")
          .select("id_insumo_extra, cantidad_porcion, precio_extra")
          .eq("id_producto", producto.id_producto),
      ]);
      setInsumos((ins as Insumo[]) ?? []);
      const map: Record<string, ExtraState> = {};
      (exs as ExtraState[] | null)?.forEach((e) => {
        map[e.id_insumo_extra] = {
          id_insumo_extra: e.id_insumo_extra,
          cantidad_porcion: Number(e.cantidad_porcion),
          precio_extra: Number(e.precio_extra),
        };
      });
      setExtras(map);
      setLoadingExtras(false);
    })();
  }, [producto.id_producto]);

  const toggleExtra = (i: Insumo, checked: boolean) => {
    setExtras((prev) => {
      const next = { ...prev };
      if (checked) next[i.id_insumo] = { id_insumo_extra: i.id_insumo, cantidad_porcion: 1, precio_extra: 0 };
      else delete next[i.id_insumo];
      return next;
    });
  };

  const setExtraField = (id: string, field: "cantidad_porcion" | "precio_extra", val: number) => {
    setExtras((prev) => ({ ...prev, [id]: { ...prev[id], [field]: val } }));
  };

  const activo = watch("activo");

  const onSubmit = async (v: ProductoInput) => {
    // Validar extras
    const lista = Object.values(extras);
    for (const e of lista) {
      if (e.cantidad_porcion <= 0) return toast.error("Hay extras con cantidad inválida");
      if (e.precio_extra < 0) return toast.error("Hay extras con precio inválido");
    }

    const { error } = await supabase.from("productos").update({
      descripcion_producto: v.descripcion_producto || null,
      precio_venta: v.precio_venta,
      url_imagen: v.url_imagen || null,
      activo: v.activo,
    }).eq("id_producto", producto.id_producto);
    if (error) return toast.error("No se pudo guardar", { description: error.message });

    const { error: eErr } = await supabase.rpc("guardar_extras_producto", {
      p_id_producto: producto.id_producto,
      p_extras: lista as unknown as never,
    });
    if (eErr) return toast.error("Producto guardado, pero los extras fallaron", { description: eErr.message });

    toast.success("Producto actualizado");
    onSuccess();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div className="space-y-1.5">
        <Label>Nombre del producto</Label>
        <Input value={producto.nombre_producto} readOnly disabled />
        <p className="text-xs text-muted-foreground">Para cambiarlo, edita la receta asociada.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="precio">Precio de venta</Label>
          <Input id="precio" type="number" step="any" min={0} {...register("precio_venta")} />
          {errors.precio_venta && <p className="text-xs text-destructive">{errors.precio_venta.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="img">URL imagen</Label>
          <Input id="img" placeholder="https://…" {...register("url_imagen")} />
          {errors.url_imagen && <p className="text-xs text-destructive">{errors.url_imagen.message}</p>}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="desc">Descripción</Label>
        <Textarea id="desc" rows={3} {...register("descripcion_producto")} placeholder="Cómo se sirve, alérgenos, etc." />
      </div>

      <div className="flex items-center justify-between rounded-md border p-3">
        <div>
          <Label htmlFor="act">Producto activo</Label>
          <p className="text-xs text-muted-foreground">Disponible para venta en el menú.</p>
        </div>
        <Switch id="act" checked={activo} onCheckedChange={(v) => setValue("activo", v, { shouldDirty: true })} />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Extras permitidos</Label>
          <Badge variant="secondary">{Object.keys(extras).length} marcado(s)</Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          Selecciona insumos que el cliente podrá agregar como extra. Configura cantidad por porción y precio.
        </p>
        <div className="rounded-md border max-h-80 overflow-y-auto divide-y">
          {loadingExtras ? (
            <p className="p-4 text-sm text-muted-foreground text-center">Cargando insumos…</p>
          ) : insumos.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground text-center">No hay insumos disponibles.</p>
          ) : insumos.map((i) => {
            const marcado = !!extras[i.id_insumo];
            const e = extras[i.id_insumo];
            return (
              <div key={i.id_insumo} className="p-2.5 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox checked={marcado} onCheckedChange={(c) => toggleExtra(i, Boolean(c))} />
                  <span className="text-sm font-medium flex-1">{i.nombre_insumo}</span>
                  <Badge variant="outline" className="text-xs">{i.unidad_receta}</Badge>
                </label>
                {marcado && (
                  <div className="grid grid-cols-2 gap-2 pl-6 animate-fade-in">
                    <div className="space-y-1">
                      <Label className="text-xs">Porción ({i.unidad_receta})</Label>
                      <Input
                        type="number" step="any" min={0.01}
                        value={e.cantidad_porcion}
                        onChange={(ev) => setExtraField(i.id_insumo, "cantidad_porcion", Number(ev.target.value) || 0)}
                        className="h-8"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Precio extra</Label>
                      <Input
                        type="number" step="any" min={0}
                        value={e.precio_extra}
                        onChange={(ev) => setExtraField(i.id_insumo, "precio_extra", Number(ev.target.value) || 0)}
                        className="h-8"
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex gap-2 pt-2">
        <Button type="button" variant="outline" className="flex-1" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" className="flex-1" disabled={isSubmitting}>
          {isSubmitting ? "Guardando…" : "Guardar cambios"}
        </Button>
      </div>
    </form>
  );
}
