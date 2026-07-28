import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarCheck, Loader2, PartyPopper, Search, Users } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/format";
import {
  listarReservasSentablesHoy,
  sentarReserva,
  type ReservaSentable,
} from "@/lib/reservas.functions";

/**
 * Sienta una reserva del día en esta mesa. Es el momento en que la decoración
 * contratada entra a la cuenta: hasta ahora la reserva no tocaba la mesa en ningún
 * punto y solo aparecía al cobrar, para descontar el abono.
 *
 * El abono NO se aplica aquí: se sigue descontando en el checkout, donde el cajero
 * elige sobre qué items va.
 */
export function AsignarReservaDialog({
  open,
  onOpenChange,
  idMesa,
  identificadorMesa,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  idMesa: string;
  identificadorMesa: string;
}) {
  const qc = useQueryClient();
  const [busqueda, setBusqueda] = useState("");

  const q = useQuery({
    queryKey: ["reservas", "sentables-hoy"],
    queryFn: () => listarReservasSentablesHoy(),
    enabled: open,
  });

  const reservas = useMemo(() => {
    const term = busqueda.trim().toLowerCase();
    const todas = q.data ?? [];
    if (!term) return todas;
    return todas.filter(
      (r) =>
        r.codigo_reserva.toLowerCase().includes(term) ||
        r.customer_name.toLowerCase().includes(term),
    );
  }, [q.data, busqueda]);

  const mut = useMutation({
    mutationFn: (idReserva: string) => sentarReserva(idReserva, idMesa),
    onSuccess: (res) => {
      const partes = [`Reserva ${res.codigo_reserva} en mesa ${identificadorMesa}`];
      if (res.id_item_decoracion && res.costo_decoracion > 0) {
        partes.push(
          `Decoración cargada: ${res.decoracion_nombre ?? "—"} ${formatMoney(res.costo_decoracion)}`,
        );
      }
      if (res.monto_abonado > 0) {
        partes.push(`Abono disponible al cobrar: ${formatMoney(res.monto_abonado)}`);
      }
      toast.success(partes[0], { description: partes.slice(1).join(" · ") || undefined });
      // `mesaSesion` es lo que pinta la cuenta de la mesa: sin esto la línea de
      // decoración no aparece hasta el siguiente refetch.
      qc.invalidateQueries({ queryKey: ["mesaSesion", idMesa] });
      qc.invalidateQueries({ queryKey: ["reservas"] });
      qc.invalidateQueries({ queryKey: ["servicio"] });
      onOpenChange(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "No se pudo asignar la reserva"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Asignar reserva a la mesa {identificadorMesa}</DialogTitle>
          <DialogDescription>
            Reservas de hoy que todavía no se han sentado. Al asignarla se carga la decoración
            contratada a la cuenta.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por código o nombre"
            className="pl-9"
            autoFocus
          />
        </div>

        <div className="max-h-80 space-y-2 overflow-y-auto">
          {q.isLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : reservas.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {(q.data ?? []).length === 0
                ? "No hay reservas pendientes de sentar hoy."
                : "Ninguna reserva coincide con la búsqueda."}
            </p>
          ) : (
            reservas.map((r) => (
              <ReservaRow
                key={r.id_reserva}
                reserva={r}
                disabled={mut.isPending}
                onSelect={() => mut.mutate(r.id_reserva)}
              />
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ReservaRow({
  reserva,
  disabled,
  onSelect,
}: {
  reserva: ReservaSentable;
  disabled: boolean;
  onSelect: () => void;
}) {
  return (
    <Button
      variant="outline"
      className="h-auto w-full justify-start px-3 py-2 text-left"
      disabled={disabled}
      onClick={onSelect}
    >
      <div className="flex w-full flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="font-semibold">{reserva.customer_name}</span>
          <Badge variant="outline" className="font-mono text-[10px]">
            {reserva.codigo_reserva}
          </Badge>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs font-normal text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <CalendarCheck className="h-3 w-3" />
            {reserva.hora_reserva}
          </span>
          <span className="inline-flex items-center gap-1">
            <Users className="h-3 w-3" />
            {reserva.cantidad_personas}
          </span>
          {reserva.decoracion_nombre && reserva.costo_decoracion > 0 && (
            <span className="inline-flex items-center gap-1">
              <PartyPopper className="h-3 w-3" />
              {reserva.decoracion_nombre} · {formatMoney(reserva.costo_decoracion)}
            </span>
          )}
          {reserva.monto_abonado > 0 && <span>Abono {formatMoney(reserva.monto_abonado)}</span>}
        </div>
      </div>
    </Button>
  );
}
