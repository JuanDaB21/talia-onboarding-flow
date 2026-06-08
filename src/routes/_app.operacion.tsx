import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, XCircle, Clock, Users, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AdminGate } from "@/components/admin/admin-gate";
import { getAlertasOperacion, getMesasOperacion, getPersonalEnTurno } from "@/lib/admin.functions";
import { listarPagosPendientes, confirmarPago } from "@/lib/pagos.functions";
import { formatMoney } from "@/lib/format";
import { POLL } from "@/lib/query-config";

export const Route = createFileRoute("/_app/operacion")({
  head: () => ({ meta: [{ title: "Operación en vivo — Talia" }] }),
  component: () => (
    <AdminGate>
      <OperacionPage />
    </AdminGate>
  ),
});

function OperacionPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Operación en vivo</h1>
        <p className="text-sm text-muted-foreground">Actualización automática cada 15 s</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <PagosPendientes />
        <Alertas />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <PersonalTurno />
        <MesasGrid />
      </div>
    </div>
  );
}

function PagosPendientes() {
  const fn = useServerFn(listarPagosPendientes);
  const conf = useServerFn(confirmarPago);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["pagos-pendientes"],
    queryFn: () => fn(),
    ...POLL.LIVE,
  });
  const [busy, setBusy] = useState<string | null>(null);

  const handle = async (idPago: string, aprobar: boolean) => {
    setBusy(idPago);
    try {
      await conf({ data: { idPago, aprobar } });
      toast.success(aprobar ? "Pago aprobado" : "Pago rechazado");
      qc.invalidateQueries({ queryKey: ["pagos-pendientes"] });
      qc.invalidateQueries({ queryKey: ["estado-caja"] });
    } catch (e) {
      toast.error("No se pudo procesar", { description: e instanceof Error ? e.message : "" });
    } finally {
      setBusy(null);
    }
  };

  const pagos = data?.pagos ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <CheckCircle2 className="h-4 w-4" /> Pagos por aprobar
          {pagos.length > 0 && <Badge variant="destructive">{pagos.length}</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading && <p className="text-sm text-muted-foreground">Cargando…</p>}
        {!isLoading && pagos.length === 0 && (
          <p className="text-sm text-muted-foreground">No hay pagos pendientes.</p>
        )}
        {pagos.map((p) => (
          <div key={p.id_pago} className="rounded-md border p-3 space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold">
                  Mesa {p.identificador_mesa} · {formatMoney(p.monto)}
                </div>
                <div className="text-xs text-muted-foreground">
                  {p.metodo}
                  {p.subtipo ? ` · ${p.subtipo}` : ""}
                  {p.mesero_nombre ? ` · ${p.mesero_nombre}` : ""}
                </div>
                <div className="text-xs text-muted-foreground">
                  {new Date(p.created_at).toLocaleTimeString()}
                </div>
              </div>
              {p.url_comprobante && (
                <a
                  href={p.url_comprobante}
                  target="_blank"
                  rel="noreferrer"
                  className="shrink-0"
                >
                  <img
                    src={p.url_comprobante}
                    alt="Comprobante"
                    loading="lazy"
                    decoding="async"
                    width={64}
                    height={64}
                    className="h-16 w-16 rounded border object-cover"
                  />
                </a>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => handle(p.id_pago, true)}
                disabled={busy === p.id_pago}
                className="flex-1"
              >
                <CheckCircle2 className="mr-1 h-4 w-4" /> Aprobar
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => handle(p.id_pago, false)}
                disabled={busy === p.id_pago}
                className="flex-1"
              >
                <XCircle className="mr-1 h-4 w-4" /> Rechazar
              </Button>
              {p.url_comprobante && (
                <Button size="sm" variant="outline" asChild>
                  <a href={p.url_comprobante} target="_blank" rel="noreferrer">
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function Alertas() {
  const fn = useServerFn(getAlertasOperacion);
  const { data, isLoading } = useQuery({
    queryKey: ["alertas-operacion"],
    queryFn: () => fn(),
    ...POLL.LIVE,
  });
  const alertas = data?.alertas ?? [];
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertTriangle className="h-4 w-4" /> Alertas de retraso
          {alertas.length > 0 && <Badge variant="destructive">{alertas.length}</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading && <p className="text-sm text-muted-foreground">Cargando…</p>}
        {!isLoading && alertas.length === 0 && (
          <p className="text-sm text-muted-foreground">Todo al día.</p>
        )}
        {alertas.map((a) => {
          const severo = a.retraso_min > a.minutos_planeados * 0.5;
          return (
            <div
              key={a.id_item}
              className={`rounded-md border p-3 ${severo ? "border-destructive/50 bg-destructive/5" : "border-amber-500/40 bg-amber-500/5"}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold">
                    {a.producto} <span className="text-muted-foreground">· Mesa {a.identificador_mesa}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {a.destino ?? "—"} · {a.estado_preparacion}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-sm font-bold text-destructive">+{a.retraso_min} min</div>
                  <div className="text-xs text-muted-foreground">
                    {a.minutos_transcurridos}/{a.minutos_planeados} min
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function PersonalTurno() {
  const fn = useServerFn(getPersonalEnTurno);
  const { data, isLoading } = useQuery({
    queryKey: ["personal-turno"],
    queryFn: () => fn(),
    ...POLL.NORMAL,
  });
  const staff = data?.staff ?? [];
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="h-4 w-4" /> Personal en turno
          <Badge variant="secondary">{staff.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading && <p className="text-sm text-muted-foreground">Cargando…</p>}
        {!isLoading && staff.length === 0 && (
          <p className="text-sm text-muted-foreground">Nadie está en turno.</p>
        )}
        {staff.map((s) => (
          <div key={s.id_usuario} className="flex items-center justify-between rounded-md border p-2">
            <div className="min-w-0">
              <div className="text-sm font-medium">{s.nombre}</div>
              <div className="text-xs text-muted-foreground">
                {s.rol}
                {s.turno_iniciado_at &&
                  ` · desde ${new Date(s.turno_iniciado_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`}
              </div>
            </div>
            {s.rol === "MESERO" && (
              <Badge variant={s.mesas_asignadas > 0 ? "default" : "outline"}>
                {s.mesas_asignadas} mesa{s.mesas_asignadas === 1 ? "" : "s"}
              </Badge>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function MesasGrid() {
  const fn = useServerFn(getMesasOperacion);
  const { data, isLoading } = useQuery({
    queryKey: ["mesas-operacion"],
    queryFn: () => fn(),
    ...POLL.LIVE,
  });
  const mesas = data?.mesas ?? [];
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Clock className="h-4 w-4" /> Mapa de mesas
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading && <p className="text-sm text-muted-foreground">Cargando…</p>}
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {mesas.map((m) => {
            const color =
              m.estado === "LIBRE"
                ? "bg-muted text-muted-foreground"
                : m.estado === "OCUPADA"
                  ? "bg-primary/15 text-primary border-primary/40"
                  : m.solicitud_cliente
                    ? "bg-destructive/15 text-destructive border-destructive/40"
                    : "bg-amber-500/15 text-amber-700 border-amber-500/40";
            return (
              <div
                key={m.id_mesa}
                className={`rounded-md border p-2 text-center text-xs ${color}`}
                title={m.mesero_nombre ?? ""}
              >
                <div className="text-sm font-bold">{m.identificador}</div>
                <div className="truncate">{m.estado}</div>
                {m.mesero_nombre && <div className="truncate opacity-70">{m.mesero_nombre}</div>}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
