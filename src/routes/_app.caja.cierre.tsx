import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Lock, AlertCircle, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { AdminGate } from "@/components/admin/admin-gate";
import { getEstadoCaja, cerrarCaja } from "@/lib/caja.functions";
import { formatMoney } from "@/lib/format";

export const Route = createFileRoute("/_app/caja/cierre")({
  head: () => ({ meta: [{ title: "Cerrar caja — Talia" }] }),
  component: () => (
    <AdminGate>
      <CierreWizard />
    </AdminGate>
  ),
});

function CierreWizard() {
  const fn = useServerFn(getEstadoCaja);
  const cerrar = useServerFn(cerrarCaja);
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ["estado-caja"],
    queryFn: () => fn(),
  });
  const [step, setStep] = useState(1);
  const [efectivoFisico, setEfectivoFisico] = useState("0");
  const [datafonoFisico, setDatafonoFisico] = useState("0");
  const [nota, setNota] = useState("");
  const [busy, setBusy] = useState(false);

  const base = data?.caja?.base_inicial ?? 0;
  const efectivoEsperado = base + (data?.efectivo ?? 0);
  const datafonoEsperado = data?.datafono ?? 0;
  const difEfectivo = useMemo(
    () => Number(efectivoFisico || 0) - efectivoEsperado,
    [efectivoFisico, efectivoEsperado],
  );
  const difDatafono = useMemo(
    () => Number(datafonoFisico || 0) - datafonoEsperado,
    [datafonoFisico, datafonoEsperado],
  );
  const hayDiferencia = difEfectivo !== 0 || difDatafono !== 0;

  if (isLoading) return <p className="text-sm text-muted-foreground">Cargando…</p>;
  if (!data?.caja)
    return (
      <Card>
        <CardContent className="p-6 text-sm">
          No hay caja abierta. <Link to="/caja" className="underline">Volver</Link>.
        </CardContent>
      </Card>
    );
  if (data.caja.estado === "CERRADA")
    return (
      <Card>
        <CardContent className="p-6 text-sm">
          La caja de hoy ya está cerrada. <Link to="/caja" className="underline">Volver</Link>.
        </CardContent>
      </Card>
    );

  const bloqueos: string[] = [];
  if (data.pagos_pendientes > 0) bloqueos.push(`${data.pagos_pendientes} pago(s) por verificar`);
  if (data.mesas_abiertas > 0) bloqueos.push(`${data.mesas_abiertas} mesa(s) abierta(s)`);

  const handleCerrar = async () => {
    if (hayDiferencia && nota.trim().length === 0) {
      toast.error("Ingresa una nota de cuadre");
      return;
    }
    setBusy(true);
    try {
      const { idCaja } = await cerrar({
        data: {
          efectivoFisico: Number(efectivoFisico),
          datafonoFisico: Number(datafonoFisico),
          nota: nota.trim() || null,
        },
      });
      toast.success("Caja cerrada");
      navigate({ to: "/caja/cierres/$id", params: { id: idCaja } });
    } catch (e) {
      toast.error("No se pudo cerrar", { description: e instanceof Error ? e.message : "" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <Button asChild variant="ghost" size="sm">
          <Link to="/caja">
            <ChevronLeft className="mr-1 h-4 w-4" /> Volver
          </Link>
        </Button>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">Cierre de caja</h1>
        <div className="mt-2 flex gap-2 text-xs text-muted-foreground">
          {[1, 2, 3, 4].map((s) => (
            <div
              key={s}
              className={`flex-1 rounded-full border px-2 py-1 text-center ${
                step >= s ? "border-primary bg-primary/10 text-primary" : ""
              }`}
            >
              Paso {s}
            </div>
          ))}
        </div>
      </div>

      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Verificación previa</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {bloqueos.length > 0 ? (
              <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
                <div className="flex items-center gap-2 font-medium text-destructive">
                  <AlertCircle className="h-4 w-4" /> Hay pendientes que impiden cerrar:
                </div>
                <ul className="ml-5 mt-1 list-disc">
                  {bloqueos.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
                <Button asChild variant="outline" size="sm" className="mt-2">
                  <Link to="/operacion">Ir a operación</Link>
                </Button>
              </div>
            ) : (
              <div className="rounded-md border border-emerald-500/40 bg-emerald-500/5 p-3 text-sm">
                <div className="flex items-center gap-2 font-medium text-emerald-700">
                  <CheckCircle2 className="h-4 w-4" /> Todo listo para cerrar.
                </div>
              </div>
            )}
            <div className="flex justify-end">
              <Button disabled={bloqueos.length > 0} onClick={() => setStep(2)}>
                Continuar <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Consolidado del sistema</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Row label="Base inicial" value={formatMoney(base)} />
            <Row label="Efectivo cobrado" value={formatMoney(data.efectivo)} />
            <Row label="Efectivo esperado en caja" value={formatMoney(efectivoEsperado)} bold />
            <Separator />
            <Row label="Transferencias" value={formatMoney(data.transferencia_confirmada)} />
            <Row label="Datáfono esperado" value={formatMoney(datafonoEsperado)} bold />
            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={() => setStep(1)}>
                <ChevronLeft className="mr-1 h-4 w-4" /> Atrás
              </Button>
              <Button onClick={() => setStep(3)}>
                Continuar <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Conteo físico</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-2">
              <Label htmlFor="ef">Efectivo total en caja (incluye base)</Label>
              <Input
                id="ef"
                type="number"
                min={0}
                value={efectivoFisico}
                onChange={(e) => setEfectivoFisico(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="df">Cierre de lote del datáfono</Label>
              <Input
                id="df"
                type="number"
                min={0}
                value={datafonoFisico}
                onChange={(e) => setDatafonoFisico(e.target.value)}
              />
            </div>
            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={() => setStep(2)}>
                <ChevronLeft className="mr-1 h-4 w-4" /> Atrás
              </Button>
              <Button onClick={() => setStep(4)}>
                Continuar <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 4 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Conciliación</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Diff label="Efectivo" sistema={efectivoEsperado} fisico={Number(efectivoFisico)} dif={difEfectivo} />
            <Diff label="Datáfono" sistema={datafonoEsperado} fisico={Number(datafonoFisico)} dif={difDatafono} />
            {hayDiferencia && (
              <div className="grid gap-2">
                <Label htmlFor="nota">
                  Nota de cuadre <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="nota"
                  rows={3}
                  placeholder="Explica el sobrante / faltante"
                  value={nota}
                  onChange={(e) => setNota(e.target.value)}
                />
              </div>
            )}
            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={() => setStep(3)} disabled={busy}>
                <ChevronLeft className="mr-1 h-4 w-4" /> Atrás
              </Button>
              <Button onClick={handleCerrar} disabled={busy}>
                <Lock className="mr-2 h-4 w-4" /> Cerrar caja
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-md border p-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={`text-sm ${bold ? "font-bold" : "font-medium"}`}>{value}</span>
    </div>
  );
}

function Diff({
  label,
  sistema,
  fisico,
  dif,
}: {
  label: string;
  sistema: number;
  fisico: number;
  dif: number;
}) {
  const color =
    dif === 0
      ? "border-emerald-500/40 bg-emerald-500/5"
      : dif > 0
        ? "border-blue-500/40 bg-blue-500/5"
        : "border-destructive/40 bg-destructive/5";
  return (
    <div className={`rounded-md border p-3 ${color}`}>
      <div className="text-sm font-semibold">{label}</div>
      <div className="mt-1 grid grid-cols-3 gap-2 text-xs">
        <div>
          <div className="text-muted-foreground">Sistema</div>
          <div className="font-medium">{formatMoney(sistema)}</div>
        </div>
        <div>
          <div className="text-muted-foreground">Físico</div>
          <div className="font-medium">{formatMoney(fisico)}</div>
        </div>
        <div>
          <div className="text-muted-foreground">Diferencia</div>
          <div className="font-bold">
            {dif > 0 ? "+" : ""}
            {formatMoney(dif)}
          </div>
        </div>
      </div>
    </div>
  );
}
