import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Camera, Loader2, QrCode, Trash2, Plus } from "lucide-react";
import { uploadToStorage, usePrivImage } from "@/lib/storage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  listarMetodosPagoQr,
  guardarMetodoPagoQr,
  eliminarMetodoPagoQr,
  PLATAFORMAS,
  type MetodoPagoQr,
  type Plataforma,
} from "@/lib/metodos-pago.functions";

interface Props {
  idNegocio: string;
}

const FIJAS: Plataforma[] = ["Nequi", "Daviplata", "Bancolombia"];

export function MetodosPagoTab({ idNegocio }: Props) {
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["metodosPagoQr"],
    queryFn: () => listarMetodosPagoQr(),
  });

  const elimMut = useMutation({
    mutationFn: (idQr: string) => eliminarMetodoPagoQr({ idQr }),
    onSuccess: () => {
      toast.success("QR eliminado");
      qc.invalidateQueries({ queryKey: ["metodosPagoQr"] });
    },
    onError: (e) =>
      toast.error("No se pudo eliminar", {
        description: e instanceof Error ? e.message : undefined,
      }),
  });

  const [edit, setEdit] = useState<{
    plataforma: Plataforma;
    registro: MetodoPagoQr | null;
  } | null>(null);

  const all = q.data ?? [];
  const otras = all.filter((m) => m.plataforma === "Otra");

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Sube el QR de cada plataforma. El mesero podrá mostrarlo al cliente al cobrar.
      </p>

      {q.isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FIJAS.map((p) => {
            const r = all.find((m) => m.plataforma === p) ?? null;
            return (
              <QrCard
                key={p}
                plataforma={p}
                registro={r}
                onEdit={() => setEdit({ plataforma: p, registro: r })}
                onDelete={() => r && elimMut.mutate(r.id_qr)}
                deleting={elimMut.isPending}
              />
            );
          })}

          {otras.map((r) => (
            <QrCard
              key={r.id_qr}
              plataforma="Otra"
              registro={r}
              onEdit={() => setEdit({ plataforma: "Otra", registro: r })}
              onDelete={() => elimMut.mutate(r.id_qr)}
              deleting={elimMut.isPending}
            />
          ))}

          <button
            type="button"
            onClick={() => setEdit({ plataforma: "Otra", registro: null })}
            className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-card p-6 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground min-h-[200px]"
          >
            <Plus className="h-6 w-6" />
            <span className="text-sm font-medium">Agregar otra plataforma</span>
          </button>
        </div>
      )}

      {edit && (
        <EditarQrDialog
          idNegocio={idNegocio}
          plataforma={edit.plataforma}
          registro={edit.registro}
          onClose={() => setEdit(null)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["metodosPagoQr"] });
            setEdit(null);
          }}
        />
      )}
    </div>
  );
}

function QrCard({
  plataforma,
  registro,
  onEdit,
  onDelete,
  deleting,
}: {
  plataforma: Plataforma;
  registro: MetodoPagoQr | null;
  onEdit: () => void;
  onDelete: () => void;
  deleting: boolean;
}) {
  const titulo = plataforma === "Otra" && registro?.etiqueta ? registro.etiqueta : plataforma;
  const qrUrl = usePrivImage(registro?.signed_url);
  return (
    <div className="rounded-xl border bg-card p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold">{titulo}</h3>
          {registro?.titular && (
            <p className="text-xs text-muted-foreground mt-0.5">{registro.titular}</p>
          )}
        </div>
        {registro && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-destructive"
            onClick={onDelete}
            disabled={deleting}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
      <div className="aspect-square rounded-lg bg-muted flex items-center justify-center overflow-hidden">
        {qrUrl ? (
          <img src={qrUrl} alt={`QR ${titulo}`} className="h-full w-full object-contain bg-white" />
        ) : (
          <QrCode className="h-12 w-12 text-muted-foreground/50" />
        )}
      </div>
      <Button variant={registro ? "outline" : "default"} size="sm" onClick={onEdit}>
        {registro ? "Cambiar QR" : "Subir QR"}
      </Button>
    </div>
  );
}

function EditarQrDialog({
  idNegocio,
  plataforma,
  registro,
  onClose,
  onSaved,
}: {
  idNegocio: string;
  plataforma: Plataforma;
  registro: MetodoPagoQr | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [etiqueta, setEtiqueta] = useState(registro?.etiqueta ?? "");
  const [titular, setTitular] = useState(registro?.titular ?? "");
  const [path, setPath] = useState<string | null>(registro?.url_qr ?? null);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const existingUrl = usePrivImage(registro?.signed_url);
  const previewUrl = localPreview ?? existingUrl;
  const [subiendo, setSubiendo] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Máximo 8MB");
      return;
    }
    setSubiendo(true);
    try {
      const { path: newPath } = await uploadToStorage("qr", file);
      setPath(newPath);
      setLocalPreview(URL.createObjectURL(file));
    } catch (err) {
      toast.error("No se pudo subir", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setSubiendo(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleGuardar() {
    if (!path) {
      toast.error("Sube una imagen del QR");
      return;
    }
    if (plataforma === "Otra" && !etiqueta.trim()) {
      toast.error("Pon un nombre a la plataforma");
      return;
    }
    setGuardando(true);
    try {
      await guardarMetodoPagoQr({
        idQr: registro?.id_qr,
        plataforma,
        etiqueta: plataforma === "Otra" ? etiqueta.trim() : null,
        titular: titular.trim() || null,
        path,
      });
      toast.success("QR guardado");
      onSaved();
    } catch (err) {
      toast.error("No se pudo guardar", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {registro ? "Editar" : "Subir"} QR · {plataforma}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {plataforma === "Otra" && (
            <div>
              <Label htmlFor="etiqueta">Nombre de la plataforma</Label>
              <Input
                id="etiqueta"
                value={etiqueta}
                onChange={(e) => setEtiqueta(e.target.value.slice(0, 40))}
                placeholder="Ej. Movii, RappiPay"
              />
            </div>
          )}
          <div>
            <Label htmlFor="titular">Titular / referencia (opcional)</Label>
            <Input
              id="titular"
              value={titular}
              onChange={(e) => setTitular(e.target.value.slice(0, 80))}
              placeholder="Ej. Juan Pérez · 300 123 4567"
            />
          </div>
          <div>
            <Label>Imagen del QR</Label>
            <div className="mt-1 aspect-square rounded-lg border bg-muted/40 flex items-center justify-center overflow-hidden">
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt="Preview QR"
                  className="h-full w-full object-contain bg-white"
                />
              ) : (
                <QrCode className="h-12 w-12 text-muted-foreground/50" />
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFile}
            />
            <Button
              type="button"
              variant="outline"
              className="w-full mt-2"
              onClick={() => fileRef.current?.click()}
              disabled={subiendo}
            >
              {subiendo ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Camera className="h-4 w-4 mr-2" />
              )}
              {path ? "Cambiar imagen" : "Subir imagen"}
            </Button>
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="ghost" onClick={onClose} disabled={guardando}>
              Cancelar
            </Button>
            <Button onClick={handleGuardar} disabled={guardando || !path}>
              {guardando && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Guardar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
