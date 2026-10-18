import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { ArrowRightLeft, CalendarCheck, Loader2, Unlink, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { formatMoney } from "@/lib/format";
import { desvincularReserva } from "@/lib/reservas.functions";
import type { ReservaVinculada } from "@/lib/servicio.functions";
import { MoverReservaDialog } from "@/components/servicio/mover-reserva-dialog";

/**
 * Muestra qué reserva quedó sentada en la mesa y ofrece dos salidas:
 *  - Mover: el grupo se cambia de mesa y TODA la cuenta lo sigue (mesa destino elegida, libre).
 *  - Quitar de la mesa: la reserva se suelta (se quita la decoración si no se cobró) y vuelve a la
 *    agenda; el consumo se queda en esta mesa como cuenta normal. Si no había consumo, la mesa
 *    queda libre.
 */
export function ReservaVinculadaBanner({
  reserva,
  idMesa,
  identificadorMesa,
}: {
  reserva: ReservaVinculada;
  idMesa: string;
  identificadorMesa: string;
}) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [moverOpen, setMoverOpen] = useState(false);

  const mut = useMutation({
    mutationFn: () => desvincularReserva(reserva.id_reserva),
    onSuccess: (res) => {
      setConfirmOpen(false);
      toast.success(`Reserva ${reserva.codigo_reserva} quitada de la mesa`, {
        description: [
          res.decoracion_quitada ? "Se quitó la decoración de la cuenta" : null,
          res.mesa_liberada ? "La mesa quedó libre" : "El consumo sigue en esta mesa",
        ]
          .filter(Boolean)
          .join(" · "),
      });
      qc.invalidateQueries({ queryKey: ["reservas"] });
      qc.invalidateQueries({ queryKey: ["servicio"] });
      qc.invalidateQueries({ queryKey: ["pagos", "items", idMesa] });
      if (res.mesa_liberada) {
        // La mesa quedó libre (sin mesero): su sesión ya no se puede abrir, se vuelve al salón.
        navigate({ to: "/servicio" });
        return;
      }
      qc.invalidateQueries({ queryKey: ["mesaSesion", idMesa] });
    },
    onError: (e) =>
      toast.error("No se pudo quitar la reserva de la mesa", {
        description: e instanceof Error ? e.message : undefined,
      }),
  });

  const detalle = [
    reserva.hora_reserva,
    `${reserva.cantidad_personas} pers.`,
    reserva.monto_abonado > 0 ? `abono ${formatMoney(reserva.monto_abonado)}` : null,
    reserva.decoracion_nombre ? `decoración: ${reserva.decoracion_nombre}` : null,
  ].filter(Boolean);

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-md border border-primary/30 bg-primary/5 px-3 py-2">
      <CalendarCheck className="h-4 w-4 shrink-0 text-primary" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">
          Reserva {reserva.codigo_reserva} · {reserva.customer_name}
        </p>
        <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
          <Users className="h-3 w-3" />
          {detalle.join(" · ")}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setMoverOpen(true)}
          disabled={mut.isPending}
        >
          <ArrowRightLeft className="mr-1 h-4 w-4" />
          Mover a otra mesa
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setConfirmOpen(true)}
          disabled={mut.isPending}
        >
          <Unlink className="mr-1 h-4 w-4" />
          Quitar de la mesa
        </Button>
      </div>

      <MoverReservaDialog
        open={moverOpen}
        onOpenChange={setMoverOpen}
        reserva={reserva}
        idMesa={idMesa}
        identificadorMesa={identificadorMesa}
      />

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              ¿Quitar la reserva {reserva.codigo_reserva} de la mesa?
            </AlertDialogTitle>
            <AlertDialogDescription>
              La reserva de {reserva.customer_name} deja de estar en esta mesa y vuelve a la agenda
              con su abono.
              {reserva.decoracion_nombre ? " Se quita la decoración de la cuenta." : ""} El consumo
              se queda en esta mesa como una cuenta normal; si no hay consumo, la mesa queda libre.
              Para cambiar el grupo de mesa con su cuenta usa «Mover a otra mesa».
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={mut.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                mut.mutate();
              }}
              disabled={mut.isPending}
            >
              {mut.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              Quitar de la mesa
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
