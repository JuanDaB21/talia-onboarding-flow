import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";

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

type DestinoInventario = "reintegrar" | "merma";

/**
 * Diálogo (admin o caja) para cancelar/devolver un item aunque ya esté en preparación
 * o entregado (mientras la cuenta no se haya pagado). Exige elegir explícitamente qué
 * pasa con el inventario (reintegrar vs. merma) y permite un motivo opcional.
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
  // Sin default: obliga a que quien cancela decida merma vs. reintegro.
  const [destino, setDestino] = useState<DestinoInventario | "">("");
  const [motivo, setMotivo] = useState("");

  // Resetea la elección cada vez que se abre para un item nuevo.
  useEffect(() => {
    if (item) {
      setDestino("");
      setMotivo("");
    }
  }, [item]);

  const mut = useMutation({
    mutationFn: () =>
      cancelarItemAdmin({
        idItem: item!.id_item,
        reponerInventario: destino === "reintegrar",
        motivo: motivo.trim() || undefined,
      }),
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
          <DialogTitle>Cancelar / devolver {item?.nombre_producto ?? "item"}</DialogTitle>
          <DialogDescription>
            Se retirará de la cuenta, se avisará a la estación y quedará registrado quién lo hizo.
            Solo funciona mientras la cuenta no se haya pagado.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-2">
            <Label>¿Qué pasa con el inventario?</Label>
            <RadioGroup
              value={destino}
              onValueChange={(v) => setDestino(v as DestinoInventario)}
              className="gap-2"
            >
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 has-[:checked]:border-primary">
                <RadioGroupItem value="reintegrar" id="reintegrar" className="mt-0.5" />
                <div className="space-y-0.5">
                  <span className="text-sm font-medium">Reintegrar al inventario</span>
                  <p className="text-xs text-muted-foreground">
                    El producto no se usó: se devuelve el stock descontado.
                  </p>
                </div>
              </label>
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 has-[:checked]:border-primary">
                <RadioGroupItem value="merma" id="merma" className="mt-0.5" />
                <div className="space-y-0.5">
                  <span className="text-sm font-medium">Descontar como merma</span>
                  <p className="text-xs text-muted-foreground">
                    El producto ya se preparó/desperdició: no se devuelve el stock.
                  </p>
                </div>
              </label>
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label htmlFor="motivo-cancelacion">Motivo (opcional)</Label>
            <Textarea
              id="motivo-cancelacion"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ej: el cliente lo devolvió, llegó mal preparado…"
              rows={2}
              maxLength={300}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Volver
          </Button>
          <Button
            variant="destructive"
            onClick={() => mut.mutate()}
            disabled={mut.isPending || !item || destino === ""}
          >
            {mut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Cancelar item"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
