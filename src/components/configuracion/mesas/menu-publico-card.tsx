import { useEffect, useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { Copy, Link2, Share2, Store } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

// Tarjeta "Menú digital para compartir": QR + enlace del menú público del NEGOCIO
// (`/carta-publica/:idNegocio`). A diferencia del QR de cada mesa, este no está
// atado a una mesa: es solo lectura y pensado para redes/WhatsApp. El cliente
// entra, mira la carta y nada más (no ocupa mesas ni llama al mesero).
export function MenuPublicoCard({ idNegocio }: { idNegocio: string }) {
  const canvasWrapperRef = useRef<HTMLDivElement | null>(null);
  // window.location no existe en SSR: resolvemos la URL tras montar.
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    setUrl(`${window.location.origin}/carta-publica/${idNegocio}`);
  }, [idNegocio]);

  const getCanvas = () =>
    canvasWrapperRef.current?.querySelector("canvas") as HTMLCanvasElement | null;

  const handleCopyImage = async () => {
    const canvas = getCanvas();
    if (!canvas) return;
    try {
      const blob: Blob | null = await new Promise((res) =>
        canvas.toBlob((b) => res(b), "image/png"),
      );
      if (!blob) throw new Error("No se pudo generar la imagen");
      if (typeof ClipboardItem === "undefined" || !navigator.clipboard?.write) {
        throw new Error("Tu navegador no soporta copiar imágenes");
      }
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      toast.success("Imagen del QR copiada");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al copiar");
    }
  };

  const handleCopyLink = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Enlace copiado al portapapeles");
    } catch {
      toast.error("No se pudo copiar el enlace");
    }
  };

  const handleShare = async () => {
    if (!url) return;
    const canvas = getCanvas();
    const shareData: ShareData = {
      title: "Nuestro menú",
      text: "Mira nuestro menú 📋",
      url,
    };
    try {
      if (canvas && navigator.canShare) {
        const blob: Blob | null = await new Promise((res) =>
          canvas.toBlob((b) => res(b), "image/png"),
        );
        if (blob) {
          const file = new File([blob], "menu.png", { type: "image/png" });
          if (navigator.canShare({ files: [file] })) {
            await navigator.share({ ...shareData, files: [file] });
            return;
          }
        }
      }
      if (navigator.share) {
        await navigator.share(shareData);
        return;
      }
      await navigator.clipboard.writeText(url);
      toast.success("Enlace copiado al portapapeles");
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return;
      toast.error("No se pudo compartir");
    }
  };

  return (
    <div className="rounded-lg border bg-card p-4 sm:p-5">
      <div className="flex flex-col sm:flex-row gap-4 sm:gap-5">
        <div
          ref={canvasWrapperRef}
          className="mx-auto sm:mx-0 bg-white p-3 rounded-md border shrink-0"
        >
          {url ? (
            <QRCodeCanvas value={url} size={140} level="M" includeMargin={false} />
          ) : (
            <div className="h-[140px] w-[140px]" />
          )}
        </div>

        <div className="flex-1 min-w-0 space-y-3">
          <div className="flex items-center gap-2">
            <Store className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-semibold">Menú digital para compartir</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Un enlace de <strong>solo lectura</strong> con tu menú, ideal para redes sociales o
            WhatsApp. Quien lo abra solo ve la carta: no puede pedir ni ocupar mesas.
          </p>
          {url && <p className="text-xs text-muted-foreground break-all">{url}</p>}
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={handleShare} disabled={!url}>
              <Share2 className="h-4 w-4 mr-1" /> Compartir
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCopyLink}
              disabled={!url}
            >
              <Link2 className="h-4 w-4 mr-1" /> Copiar enlace
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCopyImage}
              disabled={!url}
            >
              <Copy className="h-4 w-4 mr-1" /> Copiar QR
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
