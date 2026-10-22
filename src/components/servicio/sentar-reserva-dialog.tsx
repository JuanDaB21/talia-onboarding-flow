import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { ArrowLeft, CalendarCheck, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/format";
import { ordenarMesas } from "@/lib/mesas.functions";
import { sentarReserva } from "@/lib/reservas.functions";
import { listarMeserosNegocio, listarMesasServicio } from "@/lib/servicio.functions";
import { useMiStaff } from "@/hooks/use-mi-staff";
import { SelectorMesa } from "@/components/servicio/selector-mesa";

export interface ReservaPorSentar {
  id_reserva: string;
  codigo_reserva: string;
  customer_name: string;
  cantidad_personas: number;
}

/**
 * Sienta una reserva en la mesa que se ELIJA (ninguna viene marcada, ni siquiera la que está
 * abierta en pantalla). Es el momento en que la decoración contratada entra a la cuenta.
 * Una mesa libre se abre aquí mismo: el mesero queda asignado él mismo; caja/admin eligen el
 * mesero. El abono NO se aplica aquí: se sigue descontando en el checkout.
 */
export function SentarReservaDialog({
  open,
  onOpenChange,
  reserva,
  idMesaActual,
  onVolver,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  reserva: ReservaPorSentar | null;
  /** Mesa abierta en pantalla (si se viene de servicio): si se elige otra, se navega a ella. */
  idMesaActual?: string;
  /** Vuelve a la lista de reservas (cuando se viene del diálogo "Asignar reserva"). */
  onVolver?: () => void;
}) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { rol } = useMiStaff();
  const [destino, setDestino] = useState<string | null>(null);
  const [mesero, setMesero] = useState("");

  useEffect(() => {
    if (open) {
      setDestino(null);
      setMesero("");
    }
  }, [open, reserva?.id_reserva]);

  const mesasQ = useQuery({
    queryKey: ["servicio", "mesas", "todas"],
    queryFn: () => listarMesasServicio("todas"),
    enabled: open,
    staleTime: 0,
  });
  const mesas = useMemo(() => ordenarMesas(mesasQ.data?.mesas ?? []), [mesasQ.data]);
  const mesaDestino = mesas.find((m) => m.id_mesa === destino) ?? null;

  // Mesa libre sin mesero: el backend la abre. Un MESERO queda asignado él mismo; caja/admin
  // tienen que decir quién la atiende (mismo criterio que "Abrir mesa").
  const pideMesero =
    !!mesaDestino &&
    mesaDestino.estado === "LIBRE" &&
    !mesaDestino.id_mesero_asignado &&
    rol !== "MESERO";

  const meserosQ = useQuery({
    queryKey: ["meseros-negocio"],
    queryFn: () => listarMeserosNegocio(),
    enabled: open && pideMesero,
    staleTime: 30_000,
  });

  const mut = useMutation({
    mutationFn: () => sentarReserva(reserva!.id_reserva, destino!, pideMesero ? mesero : null),
    onSuccess: (res) => {
      toast.success(`Reserva ${res.codigo_reserva} en mesa ${res.identificador_mesa}`, {
        description:
          [
            res.id_item_decoracion && res.costo_decoracion > 0
              ? `Decoración cargada: ${res.decoracion_nombre ?? "—"} ${formatMoney(res.costo_decoracion)}`
              : null,
            res.monto_abonado > 0
              ? `Abono disponible al cobrar: ${formatMoney(res.monto_abonado)}`
              : null,
          ]
            .filter(Boolean)
            .join(" · ") || undefined,
      });
      // `mesaSesion` es lo que pinta la cuenta de la mesa: sin esto la línea de
      // decoración no aparece hasta el siguiente refetch.
      qc.invalidateQueries({ queryKey: ["mesaSesion", res.id_mesa] });
      qc.invalidateQueries({ queryKey: ["pagos", "items", res.id_mesa] });
      qc.invalidateQueries({ queryKey: ["reservas"] });
      qc.invalidateQueries({ queryKey: ["servicio"] });
      onOpenChange(false);
      if (idMesaActual && res.id_mesa !== idMesaActual) {
        navigate({ to: "/servicio/$idMesa", params: { idMesa: res.id_mesa } });
      }
    },
    onError: (e) =>
      toast.error("No se pudo sentar la reserva", {
        description: e instanceof Error ? e.message : undefined,
      }),
  });

  const listo = !!reserva && !!destino && (!pideMesero || !!mesero);

  return (
    <Dialog open={open} onOpenChange={(o) => !mut.isPending && onOpenChange(o)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Sentar reserva {reserva?.codigo_reserva ?? ""}</DialogTitle>
          <DialogDescription>
            {reserva ? `${reserva.customer_name} · ${reserva.cantidad_personas} pers. ` : ""}
            Elige la mesa. Al sentarla se carga la decoración contratada a la cuenta.
          </DialogDescription>
        </DialogHeader>

        <SelectorMesa
          mesas={mesas}
          valor={destino}
          onChange={(id) => {
            setDestino(id);
            setMesero("");
          }}
          cargando={mesasQ.isLoading}
          disabled={mut.isPending}
          vacio="No hay mesas configuradas."
          detalle={(m) =>
            m.estado === "LIBRE" && !m.id_mesero_asignado ? "Libre" : (m.mesero_nombre ?? "Ocupada")
          }
        />

        {pideMesero && (
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">
              La mesa {mesaDestino?.identificador} está libre: ¿qué mesero la atiende?
            </p>
            {meserosQ.isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : (meserosQ.data ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay meseros activos disponibles.</p>
            ) : (
              <Select value={mesero} onValueChange={setMesero}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un mesero" />
                </SelectTrigger>
                <SelectContent>
                  {(meserosQ.data ?? []).map((m) => (
                    <SelectItem key={m.id_usuario} value={m.id_usuario}>
                      {m.nombre}
                      {m.esta_en_turno ? "" : " (fuera de turno)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          {onVolver && (
            <Button
              variant="ghost"
              onClick={onVolver}
              disabled={mut.isPending}
              className="sm:mr-auto"
            >
              <ArrowLeft className="mr-1 h-4 w-4" />
              Otra reserva
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mut.isPending}>
            Cancelar
          </Button>
          <Button onClick={() => mut.mutate()} disabled={!listo || mut.isPending}>
            {mut.isPending ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <CalendarCheck className="mr-1 h-4 w-4" />
            )}
            Sentar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
