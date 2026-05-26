import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { editarItem } from "@/lib/servicio.functions";

export interface EditarItemDialogItem {
  id_item: string;
  nombre_producto: string;
  cantidad: number;
  tiene_alergia: boolean;
  nota: string | null;
}

export function EditarItemDialog({
  open,
  onOpenChange,
  item,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  item: EditarItemDialogItem | null;
}) {
  const qc = useQueryClient();
  const editFn = useServerFn(editarItem);
  const [cantidad, setCantidad] = useState(1);
  const [alergia, setAlergia] = useState(false);
  const [nota, setNota] = useState("");

  useEffect(() => {
    if (item) {
      setCantidad(item.cantidad);
      setAlergia(item.tiene_alergia);
      setNota(item.nota ?? "");
    }
  }, [item]);

  const mut = useMutation({
    mutationFn: () =>
      editFn({
        data: {
          idItem: item!.id_item,
          cantidad,
          tieneAlergia: alergia,
          nota,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mesaSesion"] });
      toast.success("Item actualizado");
      onOpenChange(false);
    },
    onError: (e) =>
      toast.error("No se pudo editar", {
        description: e instanceof Error ? e.message : undefined,
      }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{item?.nombre_producto ?? "—"}</DialogTitle>
          <DialogDescription>
            Solo puedes editar items que aún no entraron en preparación.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <Label>Cantidad</Label>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setCantidad((c) => Math.max(1, c - 1))}
              >
                <Minus className="h-4 w-4" />
              </Button>
              <span className="w-8 text-center font-semibold">{cantidad}</span>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setCantidad((c) => c + 1)}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-destructive/30 bg-destructive/5 p-3">
            <div className="space-y-0.5">
              <Label className="text-destructive font-semibold">🚨 Alergia</Label>
              <p className="text-xs text-muted-foreground">
                Cocina tomará precauciones estrictas.
              </p>
            </div>
            <Switch checked={alergia} onCheckedChange={setAlergia} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="nota-edit">Nota</Label>
            <Textarea
              id="nota-edit"
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending}>
            {mut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
