import { useEffect, useRef, useState } from "react";
import { Clapperboard, ImageIcon, Loader2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { publicUrl, uploadToStorage } from "@/lib/storage";
import { getThemeStyle } from "@/lib/menu-themes";
import type { AparienciaPatch } from "@/lib/negocio.functions";
import type { TipoFondoMenu } from "@/lib/menu-publico.functions";

const IMAGEN_MAX = 15 * 1024 * 1024;
const VIDEO_MAX = 20 * 1024 * 1024;
const VIDEO_SUGERIDO = 8 * 1024 * 1024;

/**
 * Extrae un cuadro del video (≈0.5 s) como JPEG para usarlo de poster: es lo que el cliente
 * ve al instante mientras el video carga, y lo único que ve con ahorro de datos.
 */
async function posterDeVideo(file: File): Promise<{ blob: Blob; duracion: number }> {
  const url = URL.createObjectURL(file);
  try {
    const v = document.createElement("video");
    v.muted = true;
    v.playsInline = true;
    v.preload = "auto";
    v.src = url;
    await new Promise<void>((res, rej) => {
      v.onloadeddata = () => res();
      v.onerror = () => rej(new Error("No se pudo leer el video"));
    });
    const duracion = v.duration;
    v.currentTime = Math.min(0.5, (duracion || 1) / 2);
    await new Promise<void>((res) => {
      v.onseeked = () => res();
    });
    const escala = Math.min(1, 1920 / Math.max(v.videoWidth, v.videoHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(v.videoWidth * escala);
    canvas.height = Math.round(v.videoHeight * escala);
    canvas.getContext("2d")!.drawImage(v, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.8));
    if (!blob) throw new Error("No se pudo generar la miniatura del video");
    return { blob, duracion };
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Card "Fondo del menú" de Apariencia: imagen o video detrás de la carta pública y de mesa.
export function FondoMenuCard({
  temaId,
  tipo,
  url,
  poster,
  oscurecer,
  onGuardar,
}: {
  temaId: string;
  tipo: TipoFondoMenu;
  url: string | null;
  poster: string | null;
  oscurecer: number;
  onGuardar: (patch: AparienciaPatch, mensaje: string) => Promise<unknown>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [velo, setVelo] = useState(oscurecer);
  useEffect(() => setVelo(oscurecer), [oscurecer]);

  const handleFile = async (file: File) => {
    const esVideo = file.type === "video/mp4" || file.type === "video/webm";
    const esImagen = ["image/jpeg", "image/png", "image/webp"].includes(file.type);
    if (!esVideo && !esImagen) {
      toast.error("Formato no soportado", { description: "Usa JPG, PNG, WEBP, MP4 o WEBM." });
      return;
    }
    if (file.size > (esVideo ? VIDEO_MAX : IMAGEN_MAX)) {
      toast.error(esVideo ? "El video no puede superar 20 MB" : "La imagen no puede superar 15 MB");
      return;
    }
    setSubiendo(true);
    try {
      if (esVideo) {
        const { blob, duracion } = await posterDeVideo(file);
        if (file.size > VIDEO_SUGERIDO || duracion > 15) {
          toast.info("Video pesado para datos móviles", {
            description: "Ideal: menos de 8 MB, 6–10 s, 720p y sin audio.",
          });
        }
        const posterFile = new File([blob], "poster.jpg", { type: "image/jpeg" });
        const [vid, pos] = await Promise.all([
          uploadToStorage("fondo_menu", file),
          uploadToStorage("fondo_menu", posterFile),
        ]);
        await onGuardar(
          { menu_fondo_tipo: "VIDEO", menu_fondo_url: vid.path, menu_fondo_poster_url: pos.path },
          "Video de fondo actualizado",
        );
      } else {
        const img = await uploadToStorage("fondo_menu", file);
        await onGuardar(
          { menu_fondo_tipo: "IMAGEN", menu_fondo_url: img.path, menu_fondo_poster_url: null },
          "Imagen de fondo actualizada",
        );
      }
    } catch (e) {
      toast.error("No se pudo subir el fondo", {
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setSubiendo(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const src = publicUrl(url);
  const posterSrc = publicUrl(poster);
  const hayFondo = tipo !== "NINGUNO" && !!src;
  const mezcla = (pct: number) =>
    `color-mix(in oklab, var(--menu-bg) ${Math.min(97, Math.round(pct))}%, transparent)`;

  return (
    <Card className="p-5">
      <div className="flex flex-col gap-5 md:flex-row">
        {/* Vista previa tipo celular con el velo real del tema elegido. */}
        <div
          className="relative isolate mx-auto aspect-[9/16] w-40 shrink-0 overflow-hidden rounded-2xl border"
          style={{ ...getThemeStyle(temaId), background: "var(--menu-bg)" }}
        >
          {hayFondo && tipo === "VIDEO" && (
            <video
              key={src}
              src={src ?? undefined}
              poster={posterSrc ?? undefined}
              muted
              loop
              autoPlay
              playsInline
              className="absolute inset-0 -z-10 h-full w-full object-cover"
            />
          )}
          {hayFondo && tipo === "IMAGEN" && (
            <img
              src={src ?? undefined}
              alt=""
              className="absolute inset-0 -z-10 h-full w-full object-cover"
            />
          )}
          {hayFondo && (
            <div
              className="absolute inset-0 -z-10"
              style={{
                background: `linear-gradient(180deg, ${mezcla(velo * 0.55)} 0%, ${mezcla(velo * 0.8)} 35%, ${mezcla(velo + 20)} 75%, ${mezcla(velo + 30)} 100%)`,
              }}
            />
          )}
          <div
            className="flex h-full flex-col justify-end gap-1.5 p-3"
            style={{ color: "var(--menu-foreground)" }}
          >
            <span className="text-sm font-bold" style={{ fontFamily: "var(--menu-heading-font)" }}>
              Tu restaurante
            </span>
            {[0, 1].map((i) => (
              <span
                key={i}
                className="block h-8 rounded-md"
                style={{
                  background: "var(--menu-surface)",
                  border: "1px solid var(--menu-border)",
                }}
              />
            ))}
          </div>
          {!hayFondo && (
            <span className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
              Sin fondo
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-4">
          <div>
            <h2 className="font-semibold">Fondo del menú</h2>
            <p className="text-sm text-muted-foreground">
              Una imagen o un video corto detrás de la carta (QR de mesa y enlace público). Se
              muestra primero una miniatura y el video carga después; con ahorro de datos o
              &quot;reducir movimiento&quot; se queda la miniatura.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,video/mp4,video/webm"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleFile(f);
              }}
            />
            <Button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={subiendo}
              className="gap-2"
            >
              {subiendo ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              {hayFondo ? "Cambiar fondo" : "Subir imagen o video"}
            </Button>
            {hayFondo && (
              <Button
                type="button"
                variant="outline"
                disabled={subiendo}
                className="gap-2"
                onClick={() =>
                  void onGuardar(
                    {
                      menu_fondo_tipo: "NINGUNO",
                      menu_fondo_url: null,
                      menu_fondo_poster_url: null,
                    },
                    "Fondo eliminado",
                  )
                }
              >
                <Trash2 className="h-4 w-4" />
                Quitar
              </Button>
            )}
          </div>

          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clapperboard className="h-3.5 w-3.5 shrink-0" />
            Video: MP4 (H.264) o WEBM, máx. 20 MB. Ideal: 6–10 s en loop, 720p, sin audio, menos de
            8 MB.
          </p>
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <ImageIcon className="h-3.5 w-3.5 shrink-0" />
            Imagen: JPG, PNG o WEBP vertical u horizontal; se optimiza antes de subir.
          </p>

          {hayFondo && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">Oscurecer para que se lea el menú</span>
                <span className="tabular-nums text-muted-foreground">{velo}%</span>
              </div>
              <Slider
                min={0}
                max={90}
                step={5}
                value={[velo]}
                onValueChange={([v]) => setVelo(v ?? 0)}
                onValueCommit={([v]) =>
                  void onGuardar({ menu_fondo_oscurecer: v ?? 0 }, "Velo del fondo guardado")
                }
                aria-label="Oscurecer el fondo"
              />
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
