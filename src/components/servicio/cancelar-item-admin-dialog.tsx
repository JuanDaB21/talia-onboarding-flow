import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { cancelarItemAdmin } from "@/lib/servicio.functions";

export interface CancelarItemAdminItem {
  id_item: string;
  nombre_producto: string;
  cantidad: number;
}

/**
 * Diálogo EXCEPCIONAL (solo admin) para cancelar un item que ya está en preparación.
 * Incluye el toggle "Reponer inventario": ON si el producto no llegó a prepararse
 * (devuelve el stock descontado), OFF si ya se desperdició.
 */
export function CancelarItemAdminDialog({
  open,
  onOpenChange,
  idMesa,
  item,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  idMesa: string;
  item: CancelarItemAdminItem | null;
}) {
  const qc = useQueryClient();
  const [reponer, setReponer] = useState(false);

  // Resetea el toggle cada vez que se abre para un item nuevo.
  useEffect(() => {
    if (item) setReponer(false);
  }, [item]);

  const mut = useMutation({
    mutationFn: () => cancelarItemAdmin({ idItem: item!.id_item, reponerInventario: reponer }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mesaSesion", idMesa] });
      toast.success("Item cancelado");
      onOpenChange(false);
    },
    onError: (e) =>
      toast.error("No se pudo cancelar", {
        description: e instanceof Error ? e.message : undefined,
      }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancelar {item?.nombre_producto ?? "item"}</DialogTitle>
          <DialogDescription>
            Acción excepcional: este producto ya está en preparación. Se retirará de la comanda, se
            avisará a la estación y quedará registrado quién lo canceló.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="space-y-0.5">
              <Label>Reponer inventario</Label>
              <p className="text-xs text-muted-foreground">
                Actívalo si el producto <strong>no</strong> se llegó a preparar (se devuelve el
                stock). Déjalo apagado si ya se desperdició.
              </p>
            </div>
            <Switch checked={reponer} onCheckedChange={setReponer} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Volver
          </Button>
          <Button
            variant="destructive"
            onClick={() => mut.mutate()}
            disabled={mut.isPending || !item}
          >
            {mut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Cancelar item"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
