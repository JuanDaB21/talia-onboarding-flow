import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Lock, Unlock, FileText, AlertCircle, Calendar as CalendarIcon, X, Plus, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { RoleGate } from "@/components/admin/role-gate";
import {
  getEstadoCaja,
  abrirCaja,
  listarCierres,
  listarTiposAjuste,
  crearTipoAjuste,
  listarAjustesCajaActual,
  crearAjusteCaja,
  eliminarAjusteCaja,
  type AjusteTipo,
  reabrirCaja,
} from "@/lib/caja.functions";
import { formatMoney } from "@/lib/format";
import { POLL } from "@/lib/query-config";


export const Route = createFileRoute("/_app/caja/")({
  head: () => ({ meta: [{ title: "Caja — Talia" }] }),
  component: () => (
    <RoleGate roles={["ADMIN","SUPERADMIN","CAJERO"]}>
      <CajaPage />
    </RoleGate>
  ),
});

function CajaPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["estado-caja"],
    queryFn: () => getEstadoCaja(),
    ...POLL.NORMAL,
  });

  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const filtros = useMemo(
    () => ({ desde: desde || null, hasta: hasta || null }),
    [desde, hasta],
  );
  const hist = useQuery({
    queryKey: ["cierres", filtros],
    queryFn: () => listarCierres(filtros),
  });

  const setHoy = () => {
    const hoy = new Date().toISOString().slice(0, 10);
    setDesde(hoy);
    setHasta(hoy);
  };
  const setUlt7 = () => {
    const h = new Date();
    const d = new Date();
    d.setDate(d.getDate() - 6);
    setDesde(d.toISOString().slice(0, 10));
    setHasta(h.toISOString().slice(0, 10));
  };
  const setMes = () => {
    const h = new Date();
    const d = new Date(h.getFullYear(), h.getMonth(), 1);
    setDesde(d.toISOString().slice(0, 10));
    setHasta(h.toISOString().slice(0, 10));
  };
  const limpiar = () => {
    setDesde("");
    setHasta("");
  };

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
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-end gap-2">
            <div className="grid gap-1">
              <Label htmlFor="desde" className="text-xs">Desde</Label>
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
              <Label htmlFor="hasta" className="text-xs">Hasta</Label>
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
                7 días
              </Button>
              <Button size="sm" variant="outline" onClick={setMes}>
                Mes
              </Button>
              {(desde || hasta) && (
                <Button size="sm" variant="ghost" onClick={limpiar}>
                  <X className="mr-1 h-3 w-3" /> Limpiar
                </Button>
              )}
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            {hist.isLoading && (
              <p className="text-sm text-muted-foreground">Cargando…</p>
            )}
            {!hist.isLoading && hist.data?.cierres.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Sin cierres en este rango.
              </p>
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
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function AbrirCajaForm() {
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
      await abrirCaja(n);
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
            <AjustesCajaLive />
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

        {cerrada && data.caja!.fecha === new Date().toISOString().slice(0, 10) && (
          <>
            <Separator />
            <ReabrirCajaButton />
          </>
        )}
      </CardContent>
    </Card>
  );
}

function ReabrirCajaButton() {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const handle = async () => {
    setBusy(true);
    try {
      await reabrirCaja();
      toast.success("Caja reabierta");
      qc.invalidateQueries({ queryKey: ["estado-caja"] });
      qc.invalidateQueries({ queryKey: ["cierres"] });
      setConfirmOpen(false);
    } catch (e) {
      toast.error("No se pudo reabrir", { description: e instanceof Error ? e.message : "" });
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">
          Si cerraste la caja por error, puedes reabrirla. Los valores de cuadre quedarán en cero y deberás volver a registrarlos al cerrar.
        </p>
        <Button variant="outline" onClick={() => setConfirmOpen(true)}>
          <Unlock className="mr-2 h-4 w-4" /> Reabrir caja
        </Button>
      </div>
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Reabrir la caja del día?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Se borrarán los valores de cuadre del cierre anterior y la caja volverá al estado ABIERTA. Esta acción quedará anotada en la nota de cuadre.
          </p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)} disabled={busy}>
              Cancelar
            </Button>
            <Button onClick={handle} disabled={busy}>
              {busy ? "Reabriendo…" : "Reabrir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
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

function AjustesCajaLive() {
  const qc = useQueryClient();

  const tipos = useQuery({ queryKey: ["caja-ajuste-tipos"], queryFn: () => listarTiposAjuste() });
  const ajustes = useQuery({ queryKey: ["caja-ajustes-actual"], queryFn: () => listarAjustesCajaActual() });

  const [selTipo, setSelTipo] = useState("");
  const [monto, setMonto] = useState("");
  const [nota, setNota] = useState("");
  const [busy, setBusy] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [newNombre, setNewNombre] = useState("");
  const [newSigno, setNewSigno] = useState<"POSITIVO" | "NEGATIVO">("NEGATIVO");
  const [creandoTipo, setCreandoTipo] = useState(false);

  const total = useMemo(
    () =>
      (ajustes.data ?? []).reduce(
        (acc, a) => acc + (a.signo === "POSITIVO" ? a.monto : -a.monto),
        0,
      ),
    [ajustes.data],
  );

  const agregar = async () => {
    const m = Number(monto);
    if (!selTipo) {
      toast.error("Selecciona un tipo");
      return;
    }
    if (!Number.isFinite(m) || m <= 0) {
      toast.error("Monto inválido");
      return;
    }
    setBusy(true);
    try {
      await crearAjusteCaja({ idTipo: selTipo, monto: m, nota: nota || null });
      toast.success("Ajuste registrado");
      setSelTipo("");
      setMonto("");
      setNota("");
      qc.invalidateQueries({ queryKey: ["caja-ajustes-actual"] });
    } catch (e) {
      toast.error("No se pudo registrar", {
        description: e instanceof Error ? e.message : "",
      });
    } finally {
      setBusy(false);
    }
  };

  const eliminar = async (idAjuste: string) => {
    try {
      await eliminarAjusteCaja(idAjuste);
      qc.invalidateQueries({ queryKey: ["caja-ajustes-actual"] });
    } catch (e) {
      toast.error("No se pudo eliminar", {
        description: e instanceof Error ? e.message : "",
      });
    }
  };

  const crearTipo = async () => {
    const nombre = newNombre.trim();
    if (!nombre) {
      toast.error("Nombre requerido");
      return;
    }
    setCreandoTipo(true);
    try {
      const t = await crearTipoAjuste({ nombre, signo: newSigno });
      toast.success("Tipo creado");
      setDialogOpen(false);
      setNewNombre("");
      setNewSigno("NEGATIVO");
      qc.invalidateQueries({ queryKey: ["caja-ajuste-tipos"] });
      setSelTipo(t.id_tipo);
    } catch (e) {
      toast.error("No se pudo crear", {
        description: e instanceof Error ? e.message : "",
      });
    } finally {
      setCreandoTipo(false);
    }
  };

  const tiposList: AjusteTipo[] = tipos.data ?? [];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Ajustes adicionales</h3>
        <Button type="button" variant="ghost" size="sm" onClick={() => setDialogOpen(true)}>
          <Plus className="mr-1 h-4 w-4" /> Nuevo tipo
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Registra sumas o restas de efectivo en cualquier momento del día (ej. propina,
        descuadre, gasto menor).
      </p>

      <div className="flex flex-wrap items-end gap-2 rounded-md border p-3">
        <div className="min-w-[160px] flex-1">
          <Label className="text-xs">Tipo</Label>
          <Select value={selTipo} onValueChange={setSelTipo}>
            <SelectTrigger>
              <SelectValue placeholder="Selecciona…" />
            </SelectTrigger>
            <SelectContent>
              {tiposList.length === 0 ? (
                <div className="px-2 py-1 text-xs text-muted-foreground">
                  No hay tipos. Crea uno con “Nuevo tipo”.
                </div>
              ) : (
                tiposList.map((t) => (
                  <SelectItem key={t.id_tipo} value={t.id_tipo}>
                    {t.nombre} ({t.signo === "POSITIVO" ? "+" : "−"})
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>
        <div className="w-28">
          <Label className="text-xs">Monto</Label>
          <Input
            type="number"
            min={0}
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            placeholder="0"
          />
        </div>
        <div className="min-w-[160px] flex-1">
          <Label className="text-xs">Nota (opcional)</Label>
          <Input
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            placeholder="Detalle"
          />
        </div>
        <Button type="button" onClick={agregar} disabled={busy}>
          Agregar
        </Button>
      </div>

      {ajustes.isLoading ? (
        <p className="text-xs text-muted-foreground">Cargando ajustes…</p>
      ) : (ajustes.data ?? []).length === 0 ? (
        <p className="text-xs text-muted-foreground">Sin ajustes registrados.</p>
      ) : (
        <ul className="space-y-1">
          {(ajustes.data ?? []).map((a) => (
            <li
              key={a.id_ajuste}
              className="flex items-center justify-between rounded-md border bg-muted/30 px-2 py-1 text-sm"
            >
              <span className="min-w-0 flex-1 truncate">
                <span className="font-medium">{a.nombre}</span>
                <span className="ml-1 text-xs text-muted-foreground">
                  ({a.signo === "POSITIVO" ? "+" : "−"})
                </span>
                {a.nota && (
                  <span className="ml-2 text-xs text-muted-foreground">· {a.nota}</span>
                )}
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
                  className="h-7 w-7"
                  onClick={() => eliminar(a.id_ajuste)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </span>
            </li>
          ))}
        </ul>
      )}

      {(ajustes.data ?? []).length > 0 && (
        <div className="flex items-center justify-between rounded-md border bg-muted/30 px-2 py-1 text-sm">
          <span className="text-muted-foreground">Total ajustes</span>
          <span className="font-bold">
            {total >= 0 ? "+" : ""}
            {formatMoney(total)}
          </span>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuevo tipo de ajuste</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid gap-2">
              <Label htmlFor="nuevo-tipo-nombre">Nombre</Label>
              <Input
                id="nuevo-tipo-nombre"
                value={newNombre}
                onChange={(e) => setNewNombre(e.target.value)}
                placeholder="Ej. Propina, Descuadre, Gasto menor"
              />
            </div>
            <div className="grid gap-2">
              <Label>Signo</Label>
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
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={creandoTipo}>
              Cancelar
            </Button>
            <Button onClick={crearTipo} disabled={creandoTipo}>
              Crear
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

