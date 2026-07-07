import { useState, type ReactNode } from "react";
import { ImageIcon, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { publicUrl, usePrivImage } from "@/lib/storage";
import { cn } from "@/lib/utils";

/**
 * Miniatura de una imagen de storage (proxy del backend) con "tocar para ver en
 * grande" (lightbox). Resuelve la URL según la visibilidad:
 * - `public` (foto de producto, logo): `publicUrl(path)` → usable en <img src>.
 * - `private` (comprobante, QR): `usePrivImage(path)` → hace fetch con el JWT y
 *   expone un object URL. Un <img>/<a> pelado NO puede pedir un objeto privado
 *   (falta Authorization: Bearer) → por eso hay que usar este componente.
 *
 * El disparador es un <span role="button">, no un <button>, para poder anidarlo
 * dentro de otro botón (p.ej. el card de producto del mesero) sin romper el DOM;
 * hace stopPropagation para no activar la acción del contenedor.
 */
export function StorageImage({
  path,
  visibility,
  alt,
  className,
  imgClassName,
  fallback,
}: {
  path: string | null | undefined;
  visibility: "public" | "private";
  alt: string;
  /** Clases del recuadro clickable (tamaño, borde, radio). */
  className?: string;
  /** Clases del <img> (object-fit, tamaño interno). */
  imgClassName?: string;
  /** Qué mostrar cuando no hay `path`. Default: ícono de imagen. */
  fallback?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  // Ambos hooks se llaman siempre (usePrivImage con null cuando no aplica).
  const priv = usePrivImage(visibility === "private" ? path ?? null : null);
  const url = visibility === "private" ? priv : publicUrl(path ?? null);

  if (!path) {
    return <>{fallback ?? <ImageIcon className="h-5 w-5 text-muted-foreground" />}</>;
  }

  const openLightbox = () => {
    if (url) setOpen(true);
  };

  return (
    <>
      <span
        role="button"
        tabIndex={0}
        aria-label={`Ver ${alt} en grande`}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          openLightbox();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            e.stopPropagation();
            openLightbox();
          }
        }}
        className={cn(
          "inline-flex items-center justify-center overflow-hidden bg-muted align-middle cursor-zoom-in",
          className,
        )}
      >
        {url ? (
          <img src={url} alt={alt} className={cn("h-full w-full object-cover", imgClassName)} />
        ) : (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </span>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl p-2 sm:p-3">
          <DialogTitle className="sr-only">{alt}</DialogTitle>
          {url && <img src={url} alt={alt} className="w-full max-h-[85vh] rounded object-contain" />}
        </DialogContent>
      </Dialog>
    </>
  );
}
