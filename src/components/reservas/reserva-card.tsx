import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { getNegocioConfig } from "@/lib/negocio.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Clock,
  Users,
  Tag,
  Phone,
  MoreVertical,
  Pencil,
  X,
  Trash2,
} from "lucide-react";
import type { Reserva } from "@/lib/reservas.functions";
import { ESTADO_LABEL, type EstadoReserva } from "@/lib/reservas.schemas";
import { cancelarReserva, eliminarReserva } from "@/lib/reservas.functions";
import { WhatsappCopyButton } from "./whatsapp-copy-button";
import { CancelarReservaDialog } from "./cancelar-reserva-dialog";

const fmt = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

const ESTADO_STYLE: Record<EstadoReserva, string> = {
  intencion: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
  abonado: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
  asistida: "bg-primary/15 text-primary",
  cancelada_devuelto: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  cancelada_retenido: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200",
};

interface Props {
  reserva: Reserva;
  onEdit: (r: Reserva) => void;
}

export function ReservaCard({ reserva, onEdit }: Props) {
  const qc = useQueryClient();
  const cancelarFn = useServerFn(cancelarReserva);
  const eliminarFn = useServerFn(eliminarReserva);
  const negocioQ = useQuery({
    queryKey: ["negocio", "config"],
    queryFn: () => getNegocioConfig(),
    staleTime: 5 * 60 * 1000,
  });
  const [cancelOpen, setCancelOpen] = useState(false);

  const cancelarMut = useMutation({
    mutationFn: (devolver: boolean) =>
      cancelarFn({ data: { id_reserva: reserva.id_reserva, devolver } }),
    onSuccess: () => {
      toast.success("Reserva cancelada");
      qc.invalidateQueries({ queryKey: ["reservas"] });
      setCancelOpen(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Error"),
  });

  const eliminarMut = useMutation({
    mutationFn: () => eliminarFn({ data: { id_reserva: reserva.id_reserva } }),
    onSuccess: () => {
      toast.success("Reserva eliminada");
      qc.invalidateQueries({ queryKey: ["reservas"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Error"),
  });

  const cancelable =
    reserva.estado === "intencion" || reserva.estado === "abonado";

  return (
    <>
      <Card>
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="flex flex-col items-center justify-center w-16 shrink-0 rounded-lg bg-primary/5 px-2 py-2">
              <Clock className="h-3.5 w-3.5 text-primary mb-1" />
              <span className="text-sm font-semibold leading-none">
                {reserva.hora_reserva}
              </span>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold truncate">{reserva.customer_name}</p>
                    <Badge variant="outline" className="text-[10px] font-mono">
                      {reserva.codigo_reserva}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                    <span className="inline-flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {reserva.cantidad_personas}
                    </span>
                    {reserva.tipo_reserva && (
                      <span className="inline-flex items-center gap-1">
                        <Tag className="h-3 w-3" />
                        {reserva.tipo_reserva}
                      </span>
                    )}
                    {reserva.customer_phone && (
                      <span className="inline-flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {reserva.customer_phone}
                      </span>
                    )}
                  </div>
                </div>
                <Badge className={ESTADO_STYLE[reserva.estado]} variant="secondary">
                  {ESTADO_LABEL[reserva.estado]}
                </Badge>
              </div>

              <div className="flex items-center justify-between mt-3">
                <div className="text-sm">
                  <span className="text-muted-foreground">Abono:</span>{" "}
                  <span className="font-semibold tabular-nums">
                    {fmt.format(reserva.monto_abonado)}
                  </span>
                  {reserva.monto_abonado > 0 && reserva.metodo_pago_label && (
                    <span className="text-xs text-muted-foreground ml-2">
                      · {reserva.metodo_pago_label}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <WhatsappCopyButton
                    nombre={reserva.customer_name}
                    fecha={reserva.fecha_reserva}
                    hora={reserva.hora_reserva}
                    codigo={reserva.codigo_reserva}
                    monto={reserva.monto_abonado}
                    telefono={reserva.customer_phone}
                    negocio={negocioQ.data?.nombre_comercial ?? null}
                  />
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onEdit(reserva)}>
                        <Pencil className="h-3.5 w-3.5 mr-2" />
                        Editar
                      </DropdownMenuItem>
                      {cancelable && (
                        <DropdownMenuItem onClick={() => setCancelOpen(true)}>
                          <X className="h-3.5 w-3.5 mr-2" />
                          Cancelar reserva
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => {
                          if (confirm("¿Eliminar definitivamente esta reserva?")) {
                            eliminarMut.mutate();
                          }
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-2" />
                        Eliminar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <CancelarReservaDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        loading={cancelarMut.isPending}
        onConfirm={async (devolver) => {
          await cancelarMut.mutateAsync(devolver);
        }}
      />
    </>
  );
}
