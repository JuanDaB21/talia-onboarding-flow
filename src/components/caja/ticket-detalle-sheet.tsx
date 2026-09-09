import { useQuery } from "@tanstack/react-query";
import { Receipt } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { LoadingState } from "@/components/common/loading-state";
import { EmptyState } from "@/components/common/empty-state";
import { ImprimirTicketButton } from "@/components/caja/imprimir-ticket-button";
import { getTicket } from "@/lib/tickets.functions";
import { formatMoney } from "@/lib/format";

/**
 * Ficha del ticket maquetada como el papel: el backend devuelve el mismo shape que arma la
 * impresión (`armarTicketPago`), así que lo que el cajero ve aquí es lo que va a salir impreso.
 */
export function TicketDetalleSheet({
  idPago,
  onClose,
}: {
  idPago: string | null;
  onClose: () => void;
}) {
  const q = useQuery({
    queryKey: ["tickets", "detalle", idPago],
    queryFn: () => getTicket(idPago!),
    enabled: !!idPago,
  });

  const t = q.data?.ticket;

  return (
    <Sheet open={!!idPago} onOpenChange={(abierto) => !abierto && onClose()}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>
            {t?.numero_ticket != null ? `Ticket #${t.numero_ticket}` : "Ticket"}
          </SheetTitle>
          <SheetDescription>
            {t ? `Mesa ${t.mesa_identificador} · ${fechaHora(t.fecha)}` : "Cargando detalle…"}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 px-4 pb-4">
          {q.isLoading ? (
            <LoadingState label="Cargando ticket…" />
          ) : !t ? (
            <EmptyState
              icon={Receipt}
              title="No se pudo cargar el ticket"
              description="Puede que el pago ya no exista."
            />
          ) : (
            <div className="space-y-4 font-mono text-sm">
              {t.mesero && (
                <p className="text-xs text-muted-foreground">Atendió: {t.mesero}</p>
              )}

              <Separator />

              <ul className="space-y-2">
                {t.items.map((item, i) => (
                  <li key={i} className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate">
                        {item.cantidad} × {item.nombre_producto}
                      </p>
                      {item.detalle.map((d, j) => (
                        <p key={j} className="truncate pl-4 text-xs text-muted-foreground">
                          {d}
                        </p>
                      ))}
                    </div>
                    <span className="shrink-0 tabular-nums">{formatMoney(item.subtotal)}</span>
                  </li>
                ))}
              </ul>

              <Separator />

              <div className="space-y-1">
                <Linea etiqueta="Subtotal" valor={t.subtotal} />
                {t.descuento > 0 && <Linea etiqueta="Descuento" valor={-t.descuento} />}
                {t.propina > 0 && <Linea etiqueta="Propina" valor={t.propina} />}
                <Linea etiqueta="TOTAL" valor={t.total} fuerte />
              </div>

              {t.partes.length > 0 && (
                <>
                  <Separator />
                  <div className="space-y-1">
                    <p className="text-xs uppercase text-muted-foreground">Pago</p>
                    {t.partes.map((parte, i) => (
                      <div key={i} className="flex items-center justify-between gap-2">
                        <span className="truncate">
                          {parte.subtipo ?? parte.metodo}
                          {parte.pendiente && (
                            <Badge variant="outline" className="ml-2 text-[10px]">
                              Pendiente
                            </Badge>
                          )}
                        </span>
                        <span className="shrink-0 tabular-nums">{formatMoney(parte.monto)}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* recibido/cambio solo existen en el ticket original: el efectivo entregado no se
                  persiste. Si llegan null, no se muestran (no son "$0"). */}
              {(t.recibido != null || t.cambio != null) && (
                <>
                  <Separator />
                  <div className="space-y-1">
                    {t.recibido != null && <Linea etiqueta="Recibido" valor={t.recibido} />}
                    {t.cambio != null && <Linea etiqueta="Cambio" valor={t.cambio} />}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {t && (
          <SheetFooter>
            <ImprimirTicketButton idPago={t.id_pago} className="w-full" />
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Linea({
  etiqueta,
  valor,
  fuerte = false,
}: {
  etiqueta: string;
  valor: number;
  fuerte?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between ${fuerte ? "text-base font-bold" : ""}`}>
      <span>{etiqueta}</span>
      <span className="tabular-nums">{formatMoney(valor)}</span>
    </div>
  );
}

const fechaHora = (iso: string) =>
  new Date(iso).toLocaleString("es-CO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
