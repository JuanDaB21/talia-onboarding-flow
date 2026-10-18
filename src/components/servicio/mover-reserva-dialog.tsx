import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { ArrowRightLeft, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ordenarMesas } from "@/lib/mesas.functions";
import { moverReserva } from "@/lib/reservas.functions";
import { listarMesasServicio, type ReservaVinculada } from "@/lib/servicio.functions";

/**
 * Cambia el grupo de la reserva a otra mesa con TODA su cuenta (pedidos enviados, el que se está
 * tomando y la decoración). Solo se ofrecen mesas libres y ninguna viene marcada: el cajero o
 * mesero tiene que elegir el destino a propósito.
 */
export function MoverReservaDialog({
  open,
  onOpenChange,
  reserva,
  idMesa,
  identificadorMesa,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  reserva: ReservaVinculada;
  idMesa: string;
  identificadorMesa: string;
}) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [destino, setDestino] = useState<string | null>(null);

  useEffect(() => {
    if (open) setDestino(null);
  }, [open]);

  const mesasQ = useQuery({
    queryKey: ["servicio", "mesas", "todas"],
    queryFn: () => listarMesasServicio("todas"),
    enabled: open,
    staleTime: 0,
  });

  const libres = useMemo(
    () =>
      ordenarMesas(
        (mesasQ.data?.mesas ?? []).filter((m) => m.estado === "LIBRE" && m.id_mesa !== idMesa),
      ),
    [mesasQ.data, idMesa],
  );

  const mut = useMutation({
    mutationFn: (idDestino: string) => moverReserva(reserva.id_reserva, idDestino),
    onSuccess: (res) => {
      toast.success(
        `Reserva ${reserva.codigo_reserva} movida a la mesa ${res.identificador_destino}`,
        { description: `La mesa ${identificadorMesa} quedó libre` },
      );
      qc.invalidateQueries({ queryKey: ["reservas"] });
      qc.invalidateQueries({ queryKey: ["servicio"] });
      qc.invalidateQueries({ queryKey: ["mesaSesion"] });
      qc.invalidateQueries({ queryKey: ["pagos", "items"] });
      onOpenChange(false);
      navigate({ to: "/servicio/$idMesa", params: { idMesa: res.id_mesa_destino } });
    },
    onError: (e) =>
      toast.error("No se pudo mover la reserva", {
        description: e instanceof Error ? e.message : undefined,
      }),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !mut.isPending && onOpenChange(o)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Mover la reserva {reserva.codigo_reserva}</DialogTitle>
          <DialogDescription>
            Todo el consumo de la mesa {identificadorMesa} pasa a la mesa que elijas, con el mismo
            mesero. La mesa {identificadorMesa} queda libre.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-72 overflow-y-auto">
          {mesasQ.isLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : libres.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No hay mesas libres en este momento.
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {libres.map((m) => (
                <Button
                  key={m.id_mesa}
                  type="button"
                  variant="outline"
                  aria-pressed={destino === m.id_mesa}
                  disabled={mut.isPending}
                  onClick={() => setDestino(m.id_mesa)}
                  className={cn(
                    "h-14 text-base font-semibold",
                    destino === m.id_mesa && "border-primary bg-primary/10 text-primary",
                  )}
                >
                  {m.identificador}
                </Button>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mut.isPending}>
            Cancelar
          </Button>
          <Button
            onClick={() => destino && mut.mutate(destino)}
            disabled={!destino || mut.isPending}
          >
            {mut.isPending ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <ArrowRightLeft className="mr-1 h-4 w-4" />
            )}
            Mover
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
