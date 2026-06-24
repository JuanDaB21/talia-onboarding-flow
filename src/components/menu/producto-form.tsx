import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { ImagePlus, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { productoSchema, type ProductoInput } from "@/lib/menu-schemas";
import { VariantesBuilder } from "./variantes-builder";
import type { Producto } from "./productos-tab";

export function ProductoForm({
  idNegocio, producto, onSuccess, onCancel,
}: { idNegocio: string; producto: Producto; onSuccess: () => void; onCancel: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [imagenFile, setImagenFile] = useState<File | null>(null);
  const [imagenUrl, setImagenUrl] = useState<string | null>(producto.url_imagen ?? null);
  const [preview, setPreview] = useState<string | null>(producto.url_imagen ?? null);
  const [uploading, setUploading] = useState(false);

  const { register, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } =
    useForm<ProductoInput>({
      resolver: zodResolver(productoSchema),
      defaultValues: {
        descripcion_producto: producto.descripcion_producto ?? "",
        precio_venta: Number(producto.precio_venta),
        activo: producto.activo,
      },
    });

  const activo = watch("activo");

  const onPickFile = (f: File | null) => {
    if (!f) return;
    if (!f.type.startsWith("image/")) return toast.error("Selecciona una imagen");
    if (f.size > 5 * 1024 * 1024) return toast.error("Máximo 5 MB");
    setImagenFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const quitarImagen = () => {
    setImagenFile(null);
    setImagenUrl(null);
    setPreview(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const onSubmit = async (v: ProductoInput) => {
    let finalUrl: string | null = imagenUrl;

    if (imagenFile) {
      setUploading(true);
      const ext = imagenFile.name.split(".").pop() || "jpg";
      const path = `${idNegocio}/${producto.id_producto}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("producto-imagenes")
        .upload(path, imagenFile, { upsert: true, contentType: imagenFile.type });
      setUploading(false);
      if (upErr) return toast.error("No se pudo subir la imagen", { description: upErr.message });
      const { data } = supabase.storage.from("producto-imagenes").getPublicUrl(path);
      finalUrl = data.publicUrl;
    }

    const { error } = await supabase.from("productos").update({
      descripcion_producto: v.descripcion_producto || null,
      precio_venta: v.precio_venta,
      url_imagen: finalUrl,
      activo: v.activo,
    }).eq("id_producto", producto.id_producto);
    if (error) return toast.error("No se pudo guardar", { description: error.message });

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

      <div className="space-y-1.5">
        <Label>Imagen del producto</Label>
        <div className="flex items-start gap-3">
          <div className="relative h-28 w-28 rounded-md border bg-muted overflow-hidden flex items-center justify-center shrink-0">
            {preview ? (
              <>
                <img src={preview} alt="Vista previa" className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={quitarImagen}
                  className="absolute top-1 right-1 h-6 w-6 rounded-full bg-background/90 border flex items-center justify-center hover:bg-destructive hover:text-destructive-foreground transition-colors"
                  aria-label="Quitar imagen"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </>
            ) : (
              <ImagePlus className="h-8 w-8 text-muted-foreground" />
            )}
          </div>
          <div className="flex-1 space-y-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
            />
            <Button type="button" variant="outline" onClick={() => fileRef.current?.click()}>
              {preview ? "Cambiar imagen" : "Subir imagen"}
            </Button>
            <p className="text-xs text-muted-foreground">PNG o JPG, máximo 5 MB.</p>
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="precio">Precio de venta</Label>
        <Input id="precio" type="number" step="any" min={0} {...register("precio_venta")} />
        {errors.precio_venta && <p className="text-xs text-destructive">{errors.precio_venta.message}</p>}
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

      <div className="flex gap-2 pt-2">
        <Button type="button" variant="outline" className="flex-1" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" className="flex-1" disabled={isSubmitting || uploading}>
          {uploading ? "Subiendo imagen…" : isSubmitting ? "Guardando…" : "Guardar cambios"}
        </Button>
      </div>
    </form>
  );
}
