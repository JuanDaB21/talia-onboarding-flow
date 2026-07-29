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
  listarMetodosPago,
  guardarMetodoPago,
  eliminarMetodoPago,
  type MetodoPago,
} from "@/lib/metodos-pago.functions";

export function MetodosPagoTab() {
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["metodosPago"],
    queryFn: () => listarMetodosPago(),
  });

  const elimMut = useMutation({
    mutationFn: (idQr: string) => eliminarMetodoPago({ idQr }),
    onSuccess: () => {
      toast.success("Método eliminado");
      qc.invalidateQueries({ queryKey: ["metodosPago"] });
    },
    onError: (e) =>
      toast.error("No se pudo eliminar", {
        description: e instanceof Error ? e.message : undefined,
      }),
  });

  // null = crear nuevo; un registro = editar existente.
  const [edit, setEdit] = useState<{ registro: MetodoPago | null } | null>(null);

  const all = q.data ?? [];

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Crea los métodos de pago que usa tu negocio con el nombre que quieras (ej. Nequi, Movii,
        Datáfono). Aparecerán tal cual al momento de cobrar. El QR es opcional: si lo subes, el
        mesero podrá mostrarlo al cliente.
      </p>

      {q.isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {all.map((r) => (
            <MetodoCard
              key={r.id_qr}
              registro={r}
              onEdit={() => setEdit({ registro: r })}
              onDelete={() => elimMut.mutate(r.id_qr)}
              deleting={elimMut.isPending}
            />
          ))}

          <button
            type="button"
            onClick={() => setEdit({ registro: null })}
            className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-card p-6 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground min-h-[200px]"
          >
            <Plus className="h-6 w-6" />
            <span className="text-sm font-medium">Agregar método de pago</span>
          </button>
        </div>
      )}

      {!q.isLoading && all.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Aún no tienes métodos de pago configurados. Crea el primero con el botón de arriba.
        </p>
      )}

      {edit && (
        <EditarMetodoDialog
          registro={edit.registro}
          onClose={() => setEdit(null)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["metodosPago"] });
            setEdit(null);
          }}
        />
      )}
    </div>
  );
}

function MetodoCard({
  registro,
  onEdit,
  onDelete,
  deleting,
}: {
  registro: MetodoPago;
  onEdit: () => void;
  onDelete: () => void;
  deleting: boolean;
}) {
  const qrUrl = usePrivImage(registro.signed_url);
  return (
    <div className="rounded-xl border bg-card p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold">{registro.nombre}</h3>
          {registro.titular && (
            <p className="text-xs text-muted-foreground mt-0.5">{registro.titular}</p>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-destructive"
          onClick={onDelete}
          disabled={deleting}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      <div className="aspect-square rounded-lg bg-muted flex items-center justify-center overflow-hidden">
        {qrUrl ? (
          <img
            src={qrUrl}
            alt={`QR ${registro.nombre}`}
            className="h-full w-full object-contain bg-white"
          />
        ) : (
          <QrCode className="h-12 w-12 text-muted-foreground/50" />
        )}
      </div>
      <Button variant="outline" size="sm" onClick={onEdit}>
        Editar
      </Button>
    </div>
  );
}

function EditarMetodoDialog({
  registro,
  onClose,
  onSaved,
}: {
  registro: MetodoPago | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [nombre, setNombre] = useState(registro?.nombre ?? "");
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
    if (!nombre.trim()) {
      toast.error("Pon un nombre al método de pago");
      return;
    }
    setGuardando(true);
    try {
      await guardarMetodoPago({
        idQr: registro?.id_qr,
        nombre: nombre.trim(),
        titular: titular.trim() || null,
        path: path || null,
      });
      toast.success("Método guardado");
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
          <DialogTitle>{registro ? "Editar" : "Nuevo"} método de pago</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="nombre">Nombre</Label>
            <Input
              id="nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value.slice(0, 40))}
              placeholder="Ej. Nequi, Movii, Datáfono"
            />
          </div>
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
            <Label>Imagen del QR (opcional)</Label>
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
            <Button onClick={handleGuardar} disabled={guardando || !nombre.trim()}>
              {guardando && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Guardar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
