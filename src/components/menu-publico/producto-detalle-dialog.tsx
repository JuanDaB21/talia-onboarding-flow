import { ImageIcon, Plus, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { CartaProducto } from "@/lib/menu-publico.functions";
import { publicUrl } from "@/lib/storage";
import type { MenuTheme } from "@/lib/menu-themes";
import { PriceTag } from "./price-tag";

interface ProductoDetalleDialogProps {
  producto: CartaProducto | null;
  theme: MenuTheme;
  themeStyle: React.CSSProperties;
  onClose: () => void;
  onAgregar?: (p: CartaProducto) => void;
}

export default function ProductoDetalleDialog({
  producto,
  theme,
  themeStyle,
  onClose,
  onAgregar,
}: ProductoDetalleDialogProps) {
  const open = producto !== null;
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="max-w-md p-0 gap-0 overflow-hidden border-0"
        style={{
          ...themeStyle,
          background: "var(--menu-surface)",
          color: "var(--menu-foreground)",
          fontFamily: "var(--menu-body-font)",
          borderRadius: "var(--menu-radius)",
        }}
      >
        {producto && (
          <>
            <button
              type="button"
              onClick={onClose}
              className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full backdrop-blur transition-colors"
              style={{
                background: "color-mix(in oklab, var(--menu-bg) 80%, transparent)",
                color: "var(--menu-foreground)",
              }}
              aria-label="Cerrar"
            >
              <X className="h-5 w-5" />
            </button>

            <div
              className="w-full overflow-hidden flex items-center justify-center"
              style={{
                background: "var(--menu-surface-2)",
                aspectRatio: "4 / 3",
              }}
            >
              {producto.url_imagen ? (
                <img
                  src={publicUrl(producto.url_imagen) ?? undefined}
                  alt={producto.nombre_producto}
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover"
                />
              ) : (
                <ImageIcon className="h-16 w-16" style={{ color: "var(--menu-muted)" }} />
              )}
            </div>

            <DialogHeader className="px-6 pt-5 pb-2 text-left space-y-2">
              <DialogTitle
                className="text-2xl font-bold leading-tight"
                style={{ fontFamily: "var(--menu-heading-font)" }}
              >
                {producto.nombre_producto}
              </DialogTitle>
              <DialogDescription
                className="text-sm leading-relaxed"
                style={{ color: "var(--menu-muted)" }}
              >
                {producto.descripcion_producto || "Sin descripción disponible."}
              </DialogDescription>
            </DialogHeader>

            <div className="px-6 pt-1 pb-5">
              <PriceTag theme={theme} precio={producto.precio_venta} />
            </div>

            <DialogFooter className="px-6 pb-6 pt-0 flex-col sm:flex-col gap-2">
              {onAgregar && (
                <Button
                  type="button"
                  onClick={() => onAgregar(producto)}
                  className="w-full h-12 text-base font-semibold gap-2"
                  style={{
                    background: "var(--menu-primary)",
                    color: "var(--menu-primary-foreground)",
                    borderRadius: "var(--menu-radius)",
                  }}
                >
                  <Plus className="h-5 w-5" />
                  Agregar a mi pedido
                </Button>
              )}
              <Button
                type="button"
                variant="ghost"
                onClick={onClose}
                className="w-full h-10 text-sm"
                style={{
                  color: "var(--menu-muted)",
                  borderRadius: "var(--menu-radius)",
                }}
              >
                Seguir viendo el menú
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
