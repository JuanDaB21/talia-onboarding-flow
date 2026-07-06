import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { QRCodeCanvas } from "qrcode.react";
import { Copy, Share2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { actualizarMesa, eliminarMesa } from "@/lib/mesas.functions";
import { mesaSchema, type MesaInput, type Mesa } from "@/lib/mesas-schemas";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  mesa: Mesa | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged: () => void;
}

export function MesaDetailDialog({ mesa, open, onOpenChange, onChanged }: Props) {
  const canvasWrapperRef = useRef<HTMLDivElement | null>(null);
  const [deleting, setDeleting] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<MesaInput>({
    resolver: zodResolver(mesaSchema),
    defaultValues: { identificador: mesa?.identificador ?? "" },
  });

  useEffect(() => {
    if (mesa) reset({ identificador: mesa.identificador });
  }, [mesa, reset]);

  if (!mesa) return null;

  const url = `${window.location.origin}/carta/${mesa.id_mesa}`;

  const getCanvas = () =>
    canvasWrapperRef.current?.querySelector("canvas") as HTMLCanvasElement | null;

  const handleCopy = async () => {
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
      const msg = e instanceof Error ? e.message : "Error al copiar";
      toast.error(msg);
    }
  };

  const handleShare = async () => {
    const canvas = getCanvas();
    const shareData: ShareData = {
      title: `Mesa: ${mesa.identificador}`,
      text: `Escanea para ordenar — Mesa ${mesa.identificador}`,
      url,
    };
    try {
      if (canvas && navigator.canShare) {
        const blob: Blob | null = await new Promise((res) =>
          canvas.toBlob((b) => res(b), "image/png"),
        );
        if (blob) {
          const file = new File([blob], `mesa-${mesa.identificador}.png`, {
            type: "image/png",
          });
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

  const onSubmit = async (values: MesaInput) => {
    try {
      await actualizarMesa({ id_mesa: mesa.id_mesa, identificador: values.identificador });
    } catch (e) {
      toast.error("No se pudo actualizar", {
        description: e instanceof Error ? e.message : undefined,
      });
      return;
    }
    toast.success("Mesa actualizada");
    onChanged();
    onOpenChange(false);
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await eliminarMesa({ id_mesa: mesa.id_mesa });
    } catch (e) {
      setDeleting(false);
      toast.error("No se pudo eliminar", {
        description: e instanceof Error ? e.message : undefined,
      });
      return;
    }
    setDeleting(false);
    toast.success("Mesa eliminada");
    onChanged();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Mesa {mesa.identificador}</DialogTitle>
          <DialogDescription>Código QR para ordenar desde esta mesa.</DialogDescription>
        </DialogHeader>

        <div className="flex justify-center">
          <div ref={canvasWrapperRef} className="bg-white p-4 rounded-md border">
            <QRCodeCanvas value={url} size={240} level="M" includeMargin={false} />
          </div>
        </div>

        <p className="text-xs text-muted-foreground break-all text-center">{url}</p>

        <div className="grid grid-cols-2 gap-2">
          <Button type="button" variant="outline" onClick={handleCopy}>
            <Copy className="h-4 w-4 mr-1" /> Copiar imagen
          </Button>
          <Button type="button" variant="outline" onClick={handleShare}>
            <Share2 className="h-4 w-4 mr-1" /> Compartir
          </Button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3 pt-2 border-t">
          <div className="space-y-1.5">
            <Label htmlFor="identificador">Identificador</Label>
            <Input id="identificador" {...register("identificador")} />
            {errors.identificador && (
              <p className="text-xs text-destructive">{errors.identificador.message}</p>
            )}
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
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
                  <AlertDialogTitle>¿Eliminar esta mesa?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta acción no se puede deshacer. El QR dejará de funcionar.
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
            <Button type="submit" className="w-full sm:flex-1" disabled={isSubmitting || !isDirty}>
              {isSubmitting ? "Guardando…" : "Guardar cambios"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
