import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { CalendarCheck, Loader2, Unlink, Users } from "lucide-react";
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

/**
 * Muestra qué reserva quedó sentada en la mesa y permite desvincularla (mesa equivocada o el
 * cliente pidió otra). Desvincular quita la decoración si no se cobró y, si la mesa quedó sin
 * consumo, la libera; la reserva vuelve a "Asignar reserva" para sentarla en la mesa correcta.
 */
export function ReservaVinculadaBanner({
  reserva,
  idMesa,
}: {
  reserva: ReservaVinculada;
  idMesa: string;
}) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const mut = useMutation({
    mutationFn: () => desvincularReserva(reserva.id_reserva),
    onSuccess: (res) => {
      setConfirmOpen(false);
      toast.success(`Reserva ${reserva.codigo_reserva} desvinculada`, {
        description: [
          res.decoracion_quitada ? "Se quitó la decoración de la cuenta" : null,
          "Siéntala en la mesa correcta con el botón Reserva",
        ]
          .filter(Boolean)
          .join(" · "),
      });
      qc.invalidateQueries({ queryKey: ["reservas"] });
      qc.invalidateQueries({ queryKey: ["servicio"] });
      if (res.mesa_liberada) {
        // La mesa quedó libre (sin mesero): su sesión ya no se puede abrir, se vuelve al salón.
        navigate({ to: "/servicio" });
        return;
      }
      qc.invalidateQueries({ queryKey: ["mesaSesion", idMesa] });
    },
    onError: (e) =>
      toast.error("No se pudo desvincular la reserva", {
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
      <Button
        variant="outline"
        size="sm"
        onClick={() => setConfirmOpen(true)}
        disabled={mut.isPending}
      >
        <Unlink className="mr-1 h-4 w-4" />
        Desvincular
      </Button>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Desvincular la reserva {reserva.codigo_reserva}?</AlertDialogTitle>
            <AlertDialogDescription>
              La reserva de {reserva.customer_name} deja de estar en esta mesa.
              {reserva.decoracion_nombre ? " Se quita la decoración de la cuenta." : ""} Si la mesa
              no tiene otros consumos, queda libre. Luego puedes sentarla en la mesa correcta; el
              abono se conserva.
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
              Desvincular
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
