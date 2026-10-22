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
import { ordenarMesas } from "@/lib/mesas.functions";
import { listarMesasServicio, trasladarMesa } from "@/lib/servicio.functions";
import { SelectorMesa } from "@/components/servicio/selector-mesa";

/**
 * Cambia el grupo de mesa con TODA su cuenta (pedidos enviados, el que se está tomando y, si la
 * mesa tiene una reserva sentada, la reserva con su decoración). Funciona con o sin reserva. Solo
 * se ofrecen mesas libres y ninguna viene marcada: hay que elegir el destino a propósito.
 */
export function TrasladarMesaDialog({
  open,
  onOpenChange,
  idMesa,
  identificadorMesa,
  codigoReserva,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  idMesa: string;
  identificadorMesa: string;
  /** Reserva sentada en la mesa, si la hay: solo para avisar que viaja con la cuenta. */
  codigoReserva?: string | null;
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
    mutationFn: (idDestino: string) => trasladarMesa(idMesa, idDestino),
    onSuccess: (res) => {
      toast.success(`Mesa ${identificadorMesa} trasladada a la mesa ${res.identificador_destino}`, {
        description: [
          res.reservas_movidas.length > 0 && codigoReserva
            ? `Reserva ${codigoReserva} incluida`
            : null,
          `La mesa ${identificadorMesa} quedó libre`,
        ]
          .filter(Boolean)
          .join(" · "),
      });
      qc.invalidateQueries({ queryKey: ["reservas"] });
      qc.invalidateQueries({ queryKey: ["servicio"] });
      qc.invalidateQueries({ queryKey: ["mesaSesion"] });
      qc.invalidateQueries({ queryKey: ["pagos", "items"] });
      onOpenChange(false);
      navigate({ to: "/servicio/$idMesa", params: { idMesa: res.id_mesa_destino } });
    },
    onError: (e) =>
      toast.error("No se pudo trasladar la mesa", {
        description: e instanceof Error ? e.message : undefined,
      }),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !mut.isPending && onOpenChange(o)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Trasladar la mesa {identificadorMesa}</DialogTitle>
          <DialogDescription>
            Todos los pedidos sin pagar de la mesa {identificadorMesa}
            {codigoReserva ? ` y la reserva ${codigoReserva}` : ""} pasan a la mesa que elijas, con
            el mismo mesero. La mesa {identificadorMesa} queda libre.
          </DialogDescription>
        </DialogHeader>

        <SelectorMesa
          mesas={libres}
          valor={destino}
          onChange={setDestino}
          cargando={mesasQ.isLoading}
          disabled={mut.isPending}
          vacio="No hay mesas libres en este momento."
        />

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
            Trasladar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
