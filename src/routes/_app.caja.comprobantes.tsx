import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Calendar as CalendarIcon, Check, ChevronLeft, ImageOff, Trash2, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { RoleGate } from "@/components/admin/role-gate";
import { StorageImage } from "@/components/shared/storage-image";
import { listarComprobantes, type ComprobantePago } from "@/lib/caja.functions";
import { fechaLocalISO, formatMoney } from "@/lib/format";

export const Route = createFileRoute("/_app/caja/comprobantes")({
  head: () => ({ meta: [{ title: "Comprobantes — Talia" }] }),
  component: () => (
    <RoleGate roles={["ADMIN", "SUPERADMIN", "CAJERO"]}>
      <ComprobantesPage />
    </RoleGate>
  ),
});

const fechaHora = (iso: string) =>
  new Date(iso).toLocaleString("es-CO", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

function ComprobantesPage() {
  const [desde, setDesde] = useState(fechaLocalISO());
  const [hasta, setHasta] = useState(fechaLocalISO());
  const filtros = useMemo(() => ({ desde, hasta }), [desde, hasta]);

  const q = useQuery({
    queryKey: ["comprobantes", filtros],
    queryFn: () => listarComprobantes(filtros),
  });

  const setHoy = () => {
    const hoy = fechaLocalISO();
    setDesde(hoy);
    setHasta(hoy);
  };
  const setUlt7 = () => {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    setDesde(fechaLocalISO(d));
    setHasta(fechaLocalISO());
  };

  const comprobantes = q.data?.comprobantes ?? [];
  const retencion = q.data?.retencionDias ?? 7;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Comprobantes</h1>
          <p className="text-sm text-muted-foreground">
            Transferencias ya aprobadas o rechazadas. Se conservan {retencion} días.
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
          <CardTitle className="text-base">Buscar por fecha</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-end gap-2">
            <div className="grid gap-1">
              <Label htmlFor="desde" className="text-xs">
                Desde
              </Label>
              <Input
                id="desde"
                type="date"
                value={desde}
                max={hasta || undefined}
                onChange={(e) => setDesde(e.target.value)}
                className="h-9 w-40"
              />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="hasta" className="text-xs">
                Hasta
              </Label>
              <Input
                id="hasta"
                type="date"
                value={hasta}
                min={desde || undefined}
                onChange={(e) => setHasta(e.target.value)}
                className="h-9 w-40"
              />
            </div>
            <div className="flex flex-wrap gap-1">
              <Button size="sm" variant="outline" onClick={setHoy}>
                <CalendarIcon className="mr-1 h-3 w-3" /> Hoy
              </Button>
              <Button size="sm" variant="outline" onClick={setUlt7}>
                {retencion} días
              </Button>
            </div>
          </div>

          {/* El backend recorta `desde` al piso de retención: si el usuario pide más
              atrás, se muestra la ventana que realmente se consultó. */}
          {q.data && q.data.desde !== desde && (
            <p className="text-xs text-muted-foreground">
              Solo se conservan {retencion} días: mostrando desde {q.data.desde}.
            </p>
          )}

          <Separator />

          {q.isLoading ? (
            <p className="text-sm text-muted-foreground">Cargando…</p>
          ) : comprobantes.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Sin transferencias resueltas en este rango.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {comprobantes.map((c) => (
                <ComprobanteCard key={c.id_pago} pago={c} retencion={retencion} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ComprobanteCard({ pago, retencion }: { pago: ComprobantePago; retencion: number }) {
  const aprobado = pago.estado_confirmacion === "CONFIRMADO";
  return (
    <article className="space-y-3 rounded-xl border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold">Mesa {pago.identificador_mesa}</p>
          <p className="text-xs text-muted-foreground">
            {fechaHora(pago.created_at)}
            {pago.mesero_nombre && ` · ${pago.mesero_nombre}`}
          </p>
        </div>
        <Badge variant={aprobado ? "secondary" : "destructive"}>
          {aprobado ? (
            <>
              <Check className="mr-1 h-3 w-3" /> Aprobado
            </>
          ) : (
            <>
              <X className="mr-1 h-3 w-3" /> Rechazado
            </>
          )}
        </Badge>
      </div>

      <div>
        {/* Número grande = total transferido (con propina), para cuadrar con el comprobante del
            banco. `monto_a_confirmar` ya suma la propina en pagos simples y la deja embebida en los
            divididos; fallback a `monto` si el backend aún no envía el campo. */}
        <p className="text-2xl font-bold tabular-nums text-primary">
          {formatMoney(pago.monto_a_confirmar ?? pago.monto)}
        </p>
        <p className="text-xs text-muted-foreground">
          {pago.subtipo ?? "Transferencia"}
          {(pago.monto_a_confirmar ?? pago.monto) > pago.monto &&
            ` · Incluye propina ${formatMoney((pago.monto_a_confirmar ?? pago.monto) - pago.monto)}`}
          {pago.confirmado_por_nombre && ` · Revisó: ${pago.confirmado_por_nombre}`}
        </p>
      </div>

      {pago.url_comprobante ? (
        <StorageImage
          path={pago.url_comprobante}
          visibility="private"
          alt={`Comprobante mesa ${pago.identificador_mesa}`}
          className="w-full rounded-lg border"
          imgClassName="w-full max-h-64 object-contain"
        />
      ) : pago.comprobante_purgado_at ? (
        <div className="flex items-center gap-2 rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
          <Trash2 className="h-4 w-4 shrink-0" />
          Comprobante purgado tras {retencion} días.
        </div>
      ) : (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <ImageOff className="h-4 w-4" /> Sin comprobante
        </div>
      )}
    </article>
  );
}
