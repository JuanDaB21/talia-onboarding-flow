import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
import { listarReservasSentablesHoy, type ReservaSentable } from "@/lib/reservas.functions";
import { SentarReservaDialog } from "@/components/servicio/sentar-reserva-dialog";

/**
 * Asignar una reserva del día a una mesa, en dos pasos: (1) elegir la reserva, (2) elegir la mesa
 * en `SentarReservaDialog`. Elegir la reserva ya no la sienta en la mesa abierta: antes un toque
 * la dejaba en esta mesa aunque el grupo fuera para otra.
 */
export function AsignarReservaDialog({
  open,
  onOpenChange,
  idMesa,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  idMesa: string;
}) {
  const [busqueda, setBusqueda] = useState("");
  const [elegida, setElegida] = useState<ReservaSentable | null>(null);

  useEffect(() => {
    if (!open) setElegida(null);
  }, [open]);

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

  return (
    <>
      <Dialog open={open && !elegida} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Asignar reserva</DialogTitle>
            <DialogDescription>
              Reservas de hoy que todavía no se han sentado. Elige la reserva y luego la mesa.
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
                <ReservaRow key={r.id_reserva} reserva={r} onSelect={() => setElegida(r)} />
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      <SentarReservaDialog
        open={open && !!elegida}
        onOpenChange={onOpenChange}
        reserva={elegida}
        idMesaActual={idMesa}
        onVolver={() => setElegida(null)}
      />
    </>
  );
}

function ReservaRow({ reserva, onSelect }: { reserva: ReservaSentable; onSelect: () => void }) {
  return (
    <Button
      variant="outline"
      className="h-auto w-full justify-start px-3 py-2 text-left"
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
