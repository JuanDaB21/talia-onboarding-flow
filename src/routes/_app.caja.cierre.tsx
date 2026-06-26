import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Lock, AlertCircle, CheckCircle2, Plus, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { RoleGate } from "@/components/admin/role-gate";
import { getEstadoCaja, cerrarCaja, listarTiposAjuste, crearTipoAjuste, type AjusteTipo } from "@/lib/caja.functions";
import { formatMoney } from "@/lib/format";

export const Route = createFileRoute("/_app/caja/cierre")({
  head: () => ({ meta: [{ title: "Cerrar caja — Talia" }] }),
  component: () => (
    <RoleGate roles={["ADMIN","SUPERADMIN","CAJERO"]}>
      <CierreWizard />
    </RoleGate>
  ),
});

function CierreWizard() {
  const fn = useServerFn(getEstadoCaja);
  const cerrar = useServerFn(cerrarCaja);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["estado-caja"],
    queryFn: () => fn(),
  });
  const tiposFn = useServerFn(listarTiposAjuste);
  const { data: tipos } = useQuery({
    queryKey: ["caja-ajuste-tipos"],
    queryFn: () => tiposFn(),
  });
  const [step, setStep] = useState(1);
  const [efectivoFisico, setEfectivoFisico] = useState("0");
  const [datafonoFisico, setDatafonoFisico] = useState("0");
  const [nota, setNota] = useState("");
  const [busy, setBusy] = useState(false);
  const [ajustes, setAjustes] = useState<
    Array<{ idTipo: string; nombre: string; signo: "POSITIVO" | "NEGATIVO"; monto: number }>
  >([]);

  const sumAjustes = useMemo(
    () => ajustes.reduce((acc, a) => acc + (a.signo === "POSITIVO" ? a.monto : -a.monto), 0),
    [ajustes],
  );
  const base = data?.caja?.base_inicial ?? 0;
  const efectivoEsperado = base + (data?.efectivo ?? 0) + sumAjustes;
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
    // Si hay ajustes, el RPC valida diferencia sin considerarlos, así que
    // construimos una nota automática para que la validación del servidor pase.
    let notaFinal = nota.trim();
    if (ajustes.length > 0) {
      const detalle = ajustes
        .map((a) => `${a.nombre}: ${a.signo === "POSITIVO" ? "+" : "-"}${a.monto}`)
        .join("; ");
      notaFinal = notaFinal
        ? `${notaFinal} | Ajustes: ${detalle}`
        : `Ajustes registrados: ${detalle}`;
    }
    setBusy(true);
    try {
      const { idCaja } = await cerrar({
        data: {
          efectivoFisico: Number(efectivoFisico),
          datafonoFisico: Number(datafonoFisico),
          nota: notaFinal || null,
          ajustes: ajustes.map((a) => ({ idTipo: a.idTipo, monto: a.monto })),
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
            <AjustesEditor
              tipos={tipos ?? []}
              ajustes={ajustes}
              onChange={setAjustes}
              onTipoCreated={() => queryClient.invalidateQueries({ queryKey: ["caja-ajuste-tipos"] })}
            />
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

type AjusteRow = { idTipo: string; nombre: string; signo: "POSITIVO" | "NEGATIVO"; monto: number };

function AjustesEditor({
  tipos,
  ajustes,
  onChange,
  onTipoCreated,
}: {
  tipos: AjusteTipo[];
  ajustes: AjusteRow[];
  onChange: (next: AjusteRow[]) => void;
  onTipoCreated: () => void;
}) {
  const crearFn = useServerFn(crearTipoAjuste);
  const [selTipo, setSelTipo] = useState<string>("");
  const [monto, setMonto] = useState<string>("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newNombre, setNewNombre] = useState("");
  const [newSigno, setNewSigno] = useState<"POSITIVO" | "NEGATIVO">("NEGATIVO");
  const [creando, setCreando] = useState(false);

  const agregar = () => {
    const tipo = tipos.find((t) => t.id_tipo === selTipo);
    const m = Number(monto);
    if (!tipo) {
      toast.error("Selecciona un tipo de ajuste");
      return;
    }
    if (!Number.isFinite(m) || m <= 0) {
      toast.error("Ingresa un monto válido");
      return;
    }
    onChange([
      ...ajustes,
      { idTipo: tipo.id_tipo, nombre: tipo.nombre, signo: tipo.signo, monto: m },
    ]);
    setSelTipo("");
    setMonto("");
  };

  const eliminar = (idx: number) => {
    onChange(ajustes.filter((_, i) => i !== idx));
  };

  const crearTipo = async () => {
    const nombre = newNombre.trim();
    if (nombre.length === 0) {
      toast.error("Nombre requerido");
      return;
    }
    setCreando(true);
    try {
      const t = await crearFn({ data: { nombre, signo: newSigno } });
      toast.success("Tipo creado");
      setDialogOpen(false);
      setNewNombre("");
      setNewSigno("NEGATIVO");
      onTipoCreated();
      setSelTipo(t.id_tipo);
    } catch (e) {
      toast.error("No se pudo crear", { description: e instanceof Error ? e.message : "" });
    } finally {
      setCreando(false);
    }
  };

  return (
    <div className="space-y-2 rounded-md border p-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-semibold">Ajustes adicionales</Label>
        <Button type="button" variant="ghost" size="sm" onClick={() => setDialogOpen(true)}>
          <Plus className="mr-1 h-4 w-4" /> Nuevo tipo
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Suma o resta al efectivo esperado (ej. descuento familia, descuadre).
      </p>

      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[180px] flex-1">
          <Label className="text-xs">Tipo</Label>
          <Select value={selTipo} onValueChange={setSelTipo}>
            <SelectTrigger>
              <SelectValue placeholder="Selecciona…" />
            </SelectTrigger>
            <SelectContent>
              {tipos.length === 0 ? (
                <div className="px-2 py-1 text-xs text-muted-foreground">
                  No hay tipos. Crea uno con “Nuevo tipo”.
                </div>
              ) : (
                tipos.map((t) => (
                  <SelectItem key={t.id_tipo} value={t.id_tipo}>
                    {t.nombre} ({t.signo === "POSITIVO" ? "+" : "−"})
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>
        <div className="w-32">
          <Label className="text-xs">Monto</Label>
          <Input
            type="number"
            min={0}
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            placeholder="0"
          />
        </div>
        <Button type="button" onClick={agregar}>
          Agregar
        </Button>
      </div>

      {ajustes.length > 0 && (
        <ul className="space-y-1 pt-2">
          {ajustes.map((a, i) => (
            <li
              key={i}
              className="flex items-center justify-between rounded-md border bg-muted/30 px-2 py-1 text-sm"
            >
              <span>
                {a.nombre}{" "}
                <span className="text-xs text-muted-foreground">
                  ({a.signo === "POSITIVO" ? "+" : "−"})
                </span>
              </span>
              <span className="flex items-center gap-2">
                <span className="font-medium">
                  {a.signo === "POSITIVO" ? "+" : "−"}
                  {formatMoney(a.monto)}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => eliminar(i)}
                  className="h-7 w-7"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </span>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuevo tipo de ajuste</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid gap-1">
              <Label htmlFor="newNombre">Nombre</Label>
              <Input
                id="newNombre"
                value={newNombre}
                onChange={(e) => setNewNombre(e.target.value)}
                placeholder="Ej: Descuento familia, Descuadre"
                maxLength={60}
              />
            </div>
            <div className="grid gap-1">
              <Label>Efecto sobre la caja</Label>
              <RadioGroup
                value={newSigno}
                onValueChange={(v) => setNewSigno(v as "POSITIVO" | "NEGATIVO")}
                className="flex gap-4"
              >
                <label className="flex items-center gap-2 text-sm">
                  <RadioGroupItem value="NEGATIVO" /> Resta (−)
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <RadioGroupItem value="POSITIVO" /> Suma (+)
                </label>
              </RadioGroup>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={creando}>
              Cancelar
            </Button>
            <Button onClick={crearTipo} disabled={creando}>
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
