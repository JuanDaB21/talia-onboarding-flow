import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Lock, Unlock, FileText, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { AdminGate } from "@/components/admin/admin-gate";
import { getEstadoCaja, abrirCaja, listarCierres } from "@/lib/caja.functions";
import { formatMoney } from "@/lib/format";

export const Route = createFileRoute("/_app/caja")({
  head: () => ({ meta: [{ title: "Caja — Talia" }] }),
  component: () => (
    <AdminGate>
      <CajaPage />
    </AdminGate>
  ),
});

function CajaPage() {
  const getEstado = useServerFn(getEstadoCaja);
  const listar = useServerFn(listarCierres);
  const { data, isLoading } = useQuery({
    queryKey: ["estado-caja"],
    queryFn: () => getEstado(),
    refetchInterval: 30_000,
  });
  const hist = useQuery({
    queryKey: ["cierres"],
    queryFn: () => listar(),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Caja</h1>
        <p className="text-sm text-muted-foreground">Gestión y arqueo diario</p>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : !data?.caja ? (
        <AbrirCajaForm />
      ) : (
        <CajaResumen data={data} />
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Historial de cierres</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {hist.data?.cierres.length === 0 && (
            <p className="text-sm text-muted-foreground">Sin cierres registrados aún.</p>
          )}
          {hist.data?.cierres.map((c) => (
            <Link
              key={c.id_caja}
              to="/caja/cierres/$id"
              params={{ id: c.id_caja }}
              className="flex items-center justify-between rounded-md border p-3 hover:bg-muted/50"
            >
              <div>
                <div className="text-sm font-medium">{c.fecha}</div>
                <div className="text-xs text-muted-foreground">
                  {c.estado} · Total {formatMoney(c.total)}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {c.diferencia !== 0 && (
                  <Badge variant="destructive">Dif {formatMoney(c.diferencia)}</Badge>
                )}
                <FileText className="h-4 w-4 text-muted-foreground" />
              </div>
            </Link>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function AbrirCajaForm() {
  const fn = useServerFn(abrirCaja);
  const qc = useQueryClient();
  const [base, setBase] = useState("0");
  const [busy, setBusy] = useState(false);

  const handle = async () => {
    const n = Number(base);
    if (Number.isNaN(n) || n < 0) {
      toast.error("Base inválida");
      return;
    }
    setBusy(true);
    try {
      await fn({ data: { base: n } });
      toast.success("Caja abierta");
      qc.invalidateQueries({ queryKey: ["estado-caja"] });
    } catch (e) {
      toast.error("No se pudo abrir", { description: e instanceof Error ? e.message : "" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Unlock className="h-4 w-4" /> Abrir caja del día
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Registra el efectivo con el que abres la caja (vueltos, fondo, etc.).
        </p>
        <div className="grid gap-2">
          <Label htmlFor="base">Base inicial (COP)</Label>
          <Input
            id="base"
            type="number"
            min={0}
            value={base}
            onChange={(e) => setBase(e.target.value)}
          />
        </div>
        <Button onClick={handle} disabled={busy}>
          <Unlock className="mr-2 h-4 w-4" /> Abrir caja
        </Button>
      </CardContent>
    </Card>
  );
}

function CajaResumen({
  data,
}: {
  data: NonNullable<Awaited<ReturnType<typeof getEstadoCaja>>>;
}) {
  const cerrada = data.caja?.estado === "CERRADA";
  const bloqueos: string[] = [];
  if (data.pagos_pendientes > 0)
    bloqueos.push(`${data.pagos_pendientes} pago(s) pendientes de verificar`);
  if (data.mesas_abiertas > 0)
    bloqueos.push(`${data.mesas_abiertas} mesa(s) con cuenta abierta`);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-base">
          <span className="flex items-center gap-2">
            {cerrada ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
            Caja del día · {data.caja!.fecha}
          </span>
          <Badge variant={cerrada ? "secondary" : "default"}>{data.caja!.estado}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Row label="Base inicial" value={formatMoney(data.caja!.base_inicial)} />
          <Row label="Efectivo cobrado" value={formatMoney(data.efectivo)} />
          <Row
            label="Transferencias confirmadas"
            value={formatMoney(data.transferencia_confirmada)}
          />
          <Row
            label="Transferencias pendientes"
            value={formatMoney(data.transferencia_pendiente)}
            highlight={data.transferencia_pendiente > 0}
          />
          <Row label="Datáfono" value={formatMoney(data.datafono)} />
          <Row
            label="Total sistema (sin base)"
            value={formatMoney(data.total_sistema)}
            bold
          />
          <Row
            label="Total sistema (con base)"
            value={formatMoney(data.total_sistema + Number(data.caja!.base_inicial))}
            bold
          />

        </div>

        {data.efectivo_por_mesero.length > 0 && (
          <>
            <Separator />
            <div>
              <h3 className="mb-2 text-sm font-semibold">Efectivo por mesero</h3>
              <div className="space-y-1">
                {data.efectivo_por_mesero.map((e) => (
                  <div key={e.id_mesero ?? e.nombre} className="flex justify-between text-sm">
                    <span>{e.nombre}</span>
                    <span className="font-medium">{formatMoney(e.monto)}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {!cerrada && (
          <>
            <Separator />
            {bloqueos.length > 0 && (
              <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
                <div className="flex items-center gap-2 font-medium text-destructive">
                  <AlertCircle className="h-4 w-4" /> No puedes cerrar aún
                </div>
                <ul className="ml-5 mt-1 list-disc text-destructive/90">
                  {bloqueos.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
                <div className="mt-2">
                  <Button asChild variant="outline" size="sm">
                    <Link to="/operacion">Ir a operación</Link>
                  </Button>
                </div>
              </div>
            )}
            <Button asChild disabled={bloqueos.length > 0}>
              <Link to="/caja/cierre">
                <Lock className="mr-2 h-4 w-4" /> Cerrar caja
              </Link>
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Row({
  label,
  value,
  bold,
  highlight,
}: {
  label: string;
  value: string;
  bold?: boolean;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center justify-between rounded-md border p-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span
        className={`text-sm ${bold ? "font-bold" : "font-medium"} ${highlight ? "text-amber-700" : ""}`}
      >
        {value}
      </span>
    </div>
  );
}
