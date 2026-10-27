import { useRef, useState } from "react";
import { ImageIcon, Loader2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { setImagenCategoria } from "@/lib/menu.functions";
import { publicUrl, uploadToStorage } from "@/lib/storage";

// Foto del tile de la categoría en la portada de la carta pública. Se guarda al instante
// (independiente del formulario); sin foto, la carta usa la del primer producto.
export function FotoCategoria({
  idCategoria,
  urlImagen,
  onCambio,
}: {
  idCategoria: string;
  urlImagen: string | null;
  onCambio: (url: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState(urlImagen);
  const [guardando, setGuardando] = useState(false);

  const guardar = async (nueva: string | null) => {
    await setImagenCategoria({ id_categoria: idCategoria, url_imagen: nueva });
    setUrl(nueva);
    onCambio(nueva);
  };

  const handleFile = async (file: File) => {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast.error("Formato no soportado", { description: "Usa JPG, PNG o WEBP." });
      return;
    }
    setGuardando(true);
    try {
      const { path } = await uploadToStorage("producto", file);
      await guardar(path);
      toast.success("Foto de la categoría actualizada");
    } catch (e) {
      toast.error("No se pudo subir la foto", {
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setGuardando(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const src = publicUrl(url);
  return (
    <div className="space-y-1.5">
      <Label>Foto en la carta pública</Label>
      <div className="flex items-center gap-3">
        <div className="flex h-20 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted">
          {src ? (
            <img src={src} alt="" className="h-full w-full object-cover" />
          ) : (
            <ImageIcon className="h-5 w-5 text-muted-foreground" />
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleFile(f);
            }}
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={guardando}
            onClick={() => inputRef.current?.click()}
            className="gap-1.5"
          >
            {guardando ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Upload className="h-3.5 w-3.5" />
            )}
            {src ? "Cambiar" : "Subir foto"}
          </Button>
          {src && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={guardando}
              onClick={() =>
                void guardar(null).catch(() => toast.error("No se pudo quitar la foto"))
              }
              className="gap-1.5"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Quitar
            </Button>
          )}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Vertical (4:5) se ve mejor. Sin foto se usa la del primer producto.
      </p>
    </div>
  );
}
