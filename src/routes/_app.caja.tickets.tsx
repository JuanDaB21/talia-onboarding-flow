import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Calendar as CalendarIcon, ChevronLeft, Receipt, Search, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RoleGate } from "@/components/admin/role-gate";
import { LoadingState } from "@/components/common/loading-state";
import { EmptyState } from "@/components/common/empty-state";
import { TicketDetalleSheet } from "@/components/caja/ticket-detalle-sheet";
import { buscarTicket, listarTickets, type TicketRow } from "@/lib/tickets.functions";
import { fechaLocalISO, formatMoney } from "@/lib/format";

export const Route = createFileRoute("/_app/caja/tickets")({
  head: () => ({ meta: [{ title: "Tickets — Talia" }] }),
  component: () => (
    <RoleGate roles={["ADMIN", "SUPERADMIN", "CAJERO"]}>
      <TicketsPage />
    </RoleGate>
  ),
});

const hora = (iso: string) =>
  new Date(iso).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });

function TicketsPage() {
  const [fecha, setFecha] = useState(fechaLocalISO());
  const [numeroInput, setNumeroInput] = useState("");
  /** Número ya confirmado (Enter o botón). Mientras sea null, manda el filtro por fecha. */
  const [numero, setNumero] = useState<number | null>(null);
  const [idPago, setIdPago] = useState<string | null>(null);

  const qDia = useQuery({
    queryKey: ["tickets", "dia", fecha],
    queryFn: () => listarTickets({ fecha }),
    enabled: numero === null,
  });

  const qBuscar = useQuery({
    queryKey: ["tickets", "buscar", numero],
    queryFn: () => buscarTicket(numero!),
    enabled: numero !== null,
  });

  const buscando = numero !== null;
  const q = buscando ? qBuscar : qDia;
  const filas: TicketRow[] = buscando
    ? (qBuscar.data?.coincidencias ?? [])
    : (qDia.data?.tickets ?? []);

  const lanzarBusqueda = () => {
    const n = Number.parseInt(numeroInput, 10);
    setNumero(Number.isFinite(n) && n > 0 ? n : null);
  };

  const limpiarBusqueda = () => {
    setNumeroInput("");
    setNumero(null);
  };

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tickets</h1>
          <p className="text-sm text-muted-foreground">
            Busca un ticket por su número o revisa los de un día para reimprimirlo.
          </p>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link to="/caja">
            <ChevronLeft className="mr-1 h-4 w-4" /> Volver a caja
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {buscando ? `Ticket #${numero}` : "Tickets del día"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-end gap-2">
            <div className="grid gap-1">
              <Label htmlFor="numero" className="text-xs">
                N° de ticket
              </Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="numero"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  placeholder="Ej. 42"
                  value={numeroInput}
                  onChange={(e) => setNumeroInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && lanzarBusqueda()}
                  className="h-9 w-36 pl-9"
                />
              </div>
            </div>
            <Button size="sm" onClick={lanzarBusqueda} disabled={!numeroInput.trim()}>
              Buscar
            </Button>
            {buscando && (
              <Button size="sm" variant="outline" onClick={limpiarBusqueda}>
                <X className="mr-1 h-3 w-3" /> Ver por fecha
              </Button>
            )}

            <div className="ml-auto flex flex-wrap items-end gap-2">
              <div className="grid gap-1">
                <Label htmlFor="fecha" className="text-xs">
                  Fecha
                </Label>
                <Input
                  id="fecha"
                  type="date"
                  value={fecha}
                  disabled={buscando}
                  onChange={(e) => setFecha(e.target.value)}
                  className="h-9 w-40"
                />
              </div>
              <Button
                size="sm"
                variant="outline"
                disabled={buscando}
                onClick={() => setFecha(fechaLocalISO())}
              >
                <CalendarIcon className="mr-1 h-3 w-3" /> Hoy
              </Button>
            </div>
          </div>

          {/* El día es OPERATIVO, no de calendario: una jornada que cruza medianoche va completa. */}
          {!buscando && qDia.data && qDia.data.fecha !== fecha && (
            <p className="text-xs text-muted-foreground">
              Mostrando el día operativo {qDia.data.fecha}.
            </p>
          )}

          <Separator />

          {q.isLoading ? (
            <LoadingState label="Cargando tickets…" />
          ) : filas.length === 0 ? (
            <EmptyState
              icon={Receipt}
              title={buscando ? `No existe el ticket #${numero}` : "Sin tickets en este día"}
              description={
                buscando
                  ? "Revisa el número impreso en el papel."
                  : "Los cobros del día operativo aparecerán aquí."
              }
            />
          ) : (
            <div className="overflow-x-auto rounded-md border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-20">N°</TableHead>
                    <TableHead className="w-20">Hora</TableHead>
                    <TableHead>Mesa</TableHead>
                    <TableHead>Mesero</TableHead>
                    <TableHead>Método</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filas.map((t) => (
                    <TableRow
                      key={t.id_pago}
                      className="cursor-pointer"
                      onClick={() => setIdPago(t.id_pago)}
                    >
                      <TableCell className="font-medium tabular-nums">
                        #{t.numero_ticket}
                        {/* El consecutivo reinicia cada año: al buscar por número hay que ver cuál es cuál. */}
                        {t.anio != null && (
                          <span className="ml-1 text-xs text-muted-foreground">/{t.anio}</span>
                        )}
                      </TableCell>
                      <TableCell className="tabular-nums">{hora(t.created_at)}</TableCell>
                      <TableCell>{t.mesa_identificador}</TableCell>
                      <TableCell className="text-muted-foreground">{t.mesero ?? "—"}</TableCell>
                      <TableCell>
                        <span className="text-sm">{t.subtipo ?? t.metodo}</span>
                        {t.dividido && (
                          <Badge variant="outline" className="ml-2 text-[10px]">
                            Dividido
                          </Badge>
                        )}
                        {t.estado_confirmacion === "PENDIENTE" && (
                          <Badge variant="outline" className="ml-2 text-[10px]">
                            Por confirmar
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatMoney(t.total)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <TicketDetalleSheet idPago={idPago} onClose={() => setIdPago(null)} />
    </div>
  );
}
