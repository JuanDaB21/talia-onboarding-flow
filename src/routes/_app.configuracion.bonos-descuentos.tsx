import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Info, Loader2, Pencil, Plus, Ticket, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import {
  listarBonos,
  crearBono,
  actualizarBono,
  eliminarBono,
  historialBonos,
  type Bono,
} from "@/lib/bonos.functions";
import { fechaLocalISO } from "@/lib/format";
import { useMiStaff } from "@/hooks/use-mi-staff";

export const Route = createFileRoute("/_app/configuracion/bonos-descuentos")({
  head: () => ({ meta: [{ title: "Bonos y descuentos — Talia" }] }),
  component: BonosDescuentosPage,
});

const fmt = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

function BonosDescuentosPage() {
  const { rol } = useMiStaff();
  const esAdmin = rol === "ADMIN" || rol === "SUPERADMIN";

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-5">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link to="/configuracion">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Configuración
          </Link>
        </Button>
      </div>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <Ticket className="h-6 w-6 text-primary" />
          Bonos y descuentos
        </h1>
        <p className="text-sm text-muted-foreground">
          Crea bonos de descuento y revisa cuánto se ha regalado.
        </p>
      </div>

      {!esAdmin ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Solo administradores pueden gestionar esta sección.
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="bonos">
          <TabsList>
            <TabsTrigger value="bonos">Bonos</TabsTrigger>
            <TabsTrigger value="historial">Historial</TabsTrigger>
          </TabsList>
          <TabsContent value="bonos" className="mt-4">
            <BonosTab />
          </TabsContent>
          <TabsContent value="historial" className="mt-4">
            <HistorialTab />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

function BonosTab() {
  const qc = useQueryClient();

  const q = useQuery({ queryKey: ["bonos"], queryFn: () => listarBonos() });

  const [openCrear, setOpenCrear] = useState(false);
  const [editar, setEditar] = useState<Bono | null>(null);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["bonos"] });

  const crearMut = useMutation({
    mutationFn: (input: {
      nombre: string;
      tipo: "PORCENTAJE" | "VALOR";
      porcentaje: number | null;
      valor: number | null;
    }) => crearBono(input),
    onSuccess: () => {
      toast.success("Bono creado");
      setOpenCrear(false);
      invalidate();
    },
    onError: (e) =>
      toast.error("No se pudo crear", {
        description: e instanceof Error ? e.message : undefined,
      }),
  });

  const actualizarMut = useMutation({
    mutationFn: (input: {
      idBono: string;
      nombre: string;
      tipo: "PORCENTAJE" | "VALOR";
      porcentaje: number | null;
      valor: number | null;
      activo: boolean;
    }) => actualizarBono(input),
    onSuccess: () => {
      toast.success("Bono actualizado");
      setEditar(null);
      invalidate();
    },
    onError: (e) =>
      toast.error("No se pudo actualizar", {
        description: e instanceof Error ? e.message : undefined,
      }),
  });

  const eliminarMut = useMutation({
    mutationFn: (idBono: string) => eliminarBono({ idBono }),
    onSuccess: () => {
      toast.success("Bono desactivado");
      invalidate();
    },
    onError: (e) =>
      toast.error("No se pudo desactivar", {
        description: e instanceof Error ? e.message : undefined,
      }),
  });

  const bonos = q.data?.bonos ?? [];

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setOpenCrear(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Crear bono
        </Button>
      </div>

      {q.isLoading ? (
        <div className="flex justify-center p-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : bonos.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            Aún no hay bonos. Crea el primero para que los meseros lo puedan aplicar al cobrar.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {bonos.map((b) => (
            <Card key={b.id_bono} className={!b.activo ? "opacity-60" : ""}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base">{b.nombre}</CardTitle>
                  {!b.activo && <Badge variant="secondary">Inactivo</Badge>}
                </div>
                <CardDescription className="text-2xl font-bold text-primary">
                  {b.tipo === "PORCENTAJE" ? `${b.porcentaje ?? 0}%` : fmt.format(b.valor)}
                </CardDescription>
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  {b.tipo === "PORCENTAJE" ? "Porcentaje" : "Valor fijo"}
                </p>
              </CardHeader>
              <CardContent className="flex gap-2 pt-0">
                <Button variant="outline" size="sm" onClick={() => setEditar(b)}>
                  <Pencil className="h-3.5 w-3.5 mr-1" />
                  Editar
                </Button>
                {b.activo && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => eliminarMut.mutate(b.id_bono)}
                    disabled={eliminarMut.isPending}
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1 text-destructive" />
                    Desactivar
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <BonoDialog
        open={openCrear}
        onOpenChange={setOpenCrear}
        onSubmit={(v) =>
          crearMut.mutate({
            nombre: v.nombre,
            tipo: v.tipo,
            porcentaje: v.tipo === "PORCENTAJE" ? v.porcentaje : null,
            valor: v.tipo === "VALOR" ? v.valor : null,
          })
        }
        loading={crearMut.isPending}
        title="Crear bono"
      />
      <BonoDialog
        open={!!editar}
        onOpenChange={(o) => !o && setEditar(null)}
        initial={editar ?? undefined}
        onSubmit={(v) =>
          editar &&
          actualizarMut.mutate({
            idBono: editar.id_bono,
            nombre: v.nombre,
            tipo: v.tipo,
            porcentaje: v.tipo === "PORCENTAJE" ? v.porcentaje : null,
            valor: v.tipo === "VALOR" ? v.valor : null,
            activo: v.activo ?? editar.activo,
          })
        }
        loading={actualizarMut.isPending}
        title="Editar bono"
        showActivo
      />
    </div>
  );
}

function BonoDialog({
  open,
  onOpenChange,
  initial,
  onSubmit,
  loading,
  title,
  showActivo,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initial?: Bono;
  onSubmit: (v: {
    nombre: string;
    tipo: "PORCENTAJE" | "VALOR";
    porcentaje: number;
    valor: number;
    activo?: boolean;
  }) => void;
  loading: boolean;
  title: string;
  showActivo?: boolean;
}) {
  const [nombre, setNombre] = useState(initial?.nombre ?? "");
  const [tipo, setTipo] = useState<"PORCENTAJE" | "VALOR">(initial?.tipo ?? "PORCENTAJE");
  const [porcentaje, setPorcentaje] = useState<string>(
    initial?.porcentaje != null ? String(initial.porcentaje) : "",
  );
  const [valor, setValor] = useState<string>(
    initial && initial.tipo === "VALOR" ? String(initial.valor) : "",
  );
  const [activo, setActivo] = useState(initial?.activo ?? true);

  useMemo(() => {
    if (open) {
      setNombre(initial?.nombre ?? "");
      setTipo(initial?.tipo ?? "PORCENTAJE");
      setPorcentaje(initial?.porcentaje != null ? String(initial.porcentaje) : "");
      setValor(initial && initial.tipo === "VALOR" ? String(initial.valor) : "");
      setActivo(initial?.activo ?? true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial?.id_bono]);

  const pct = Number(porcentaje);
  const val = Number(valor);
  const valido =
    nombre.trim().length > 0 &&
    (tipo === "PORCENTAJE"
      ? Number.isFinite(pct) && pct > 0 && pct <= 100
      : Number.isFinite(val) && val > 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="bono-nombre">Nombre</Label>
            <Input
              id="bono-nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value.slice(0, 80))}
              placeholder="Ej: Cumpleaños"
            />
          </div>
          <div>
            <Label>Tipo de descuento</Label>
            <Select value={tipo} onValueChange={(v) => setTipo(v as "PORCENTAJE" | "VALOR")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PORCENTAJE">Porcentaje (%)</SelectItem>
                <SelectItem value="VALOR">Valor fijo ($)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {tipo === "PORCENTAJE" ? (
            <div>
              <Label htmlFor="bono-pct">Porcentaje de descuento</Label>
              <div className="relative">
                <Input
                  id="bono-pct"
                  inputMode="decimal"
                  value={porcentaje}
                  onChange={(e) => setPorcentaje(e.target.value.replace(/[^\d.]/g, ""))}
                  placeholder="10"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  %
                </span>
              </div>
            </div>
          ) : (
            <div>
              <Label htmlFor="bono-val">Valor del descuento</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  $
                </span>
                <Input
                  id="bono-val"
                  inputMode="numeric"
                  className="pl-7"
                  value={valor}
                  onChange={(e) => setValor(e.target.value.replace(/[^\d]/g, ""))}
                  placeholder="5000"
                />
              </div>
            </div>
          )}
          {showActivo && (
            <div className="flex items-center justify-between">
              <Label htmlFor="bono-activo">Activo</Label>
              <Switch id="bono-activo" checked={activo} onCheckedChange={setActivo} />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            disabled={!valido || loading}
            onClick={() =>
              onSubmit({
                nombre: nombre.trim(),
                tipo,
                porcentaje: tipo === "PORCENTAJE" ? pct : 0,
                valor: tipo === "VALOR" ? val : 0,
                activo: showActivo ? activo : undefined,
              })
            }
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function HistorialTab() {
  const hoy = new Date();
  const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);

  const [desde, setDesde] = useState<string>(fechaLocalISO(inicioMes));
  const [hasta, setHasta] = useState<string>(fechaLocalISO(hoy));
  const [idMesero, setIdMesero] = useState<string>("todos");

  const q = useQuery({
    queryKey: ["bonos", "historial", desde, hasta, idMesero],
    queryFn: () =>
      historialBonos({
        desde: desde ? new Date(desde + "T00:00:00").toISOString() : null,
        hasta: hasta ? new Date(hasta + "T23:59:59").toISOString() : null,
        idMesero: idMesero === "todos" ? null : idMesero,
      }),
  });

  const data = q.data;

  return (
    <TooltipProvider delayDuration={150}>
      <div className="space-y-4">
        <Card>
          <CardContent className="p-4 grid gap-3 sm:grid-cols-3">
            <div>
              <Label htmlFor="f-desde">Desde</Label>
              <Input
                id="f-desde"
                type="date"
                value={desde}
                onChange={(e) => setDesde(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="f-hasta">Hasta</Label>
              <Input
                id="f-hasta"
                type="date"
                value={hasta}
                onChange={(e) => setHasta(e.target.value)}
              />
            </div>
            <div>
              <Label>Mesero</Label>
              <Select value={idMesero} onValueChange={setIdMesero}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {(data?.meseros ?? []).map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-3 sm:grid-cols-3">
          <KpiCard
            label="Total regalado"
            value={fmt.format(data?.total_regalado ?? 0)}
            tooltip="Lo que el cliente dejó de pagar, calculado sobre el precio de venta."
            highlight
          />
          <KpiCard
            label="Regalado neto"
            value={fmt.format(data?.total_neto ?? 0)}
            tooltip="Lo que realmente le costó al negocio: el descuento multiplicado por el margen de ganancia de los alimentos vendidos. Fórmula: descuento × (precio − costo) / precio."
          />
          <KpiCard
            label="Aplicaciones"
            value={String(data?.total_aplicaciones ?? 0)}
            tooltip="Número de veces que se aplicó un bono en el rango seleccionado."
          />
        </div>

        <Card>
          <CardContent className="p-0">
            {q.isLoading ? (
              <div className="flex justify-center p-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (data?.aplicaciones.length ?? 0) === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                Sin aplicaciones en el rango seleccionado.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="text-left p-3">Fecha</th>
                      <th className="text-left p-3">Mesa</th>
                      <th className="text-left p-3">Mesero</th>
                      <th className="text-left p-3">Bono</th>
                      <th className="text-right p-3">%</th>
                      <th className="text-right p-3">Regalado</th>
                      <th className="text-right p-3">Neto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data!.aplicaciones.map((a) => (
                      <tr key={a.id_aplicacion} className="border-t hover:bg-muted/20">
                        <td className="p-3 text-xs text-muted-foreground">
                          {new Date(a.created_at).toLocaleString("es-CO", {
                            dateStyle: "short",
                            timeStyle: "short",
                          })}
                        </td>
                        <td className="p-3">{a.identificador_mesa ?? "—"}</td>
                        <td className="p-3">{a.mesero_nombre ?? "—"}</td>
                        <td className="p-3">{a.nombre_bono}</td>
                        <td className="p-3 text-right tabular-nums">{a.porcentaje_aplicado}%</td>
                        <td className="p-3 text-right tabular-nums font-medium">
                          {fmt.format(a.monto_descuento)}
                        </td>
                        <td className="p-3 text-right tabular-nums text-muted-foreground">
                          {fmt.format(a.monto_descuento_neto)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  );
}

function KpiCard({
  label,
  value,
  tooltip,
  highlight,
}: {
  label: string;
  value: string;
  tooltip: string;
  highlight?: boolean;
}) {
  return (
    <Card className={highlight ? "border-primary/40 bg-primary/5" : ""}>
      <CardContent className="p-4 space-y-1">
        <div className="flex items-center gap-1 text-xs uppercase tracking-wider text-muted-foreground">
          <span>{label}</span>
          <Tooltip>
            <TooltipTrigger asChild>
              <button type="button" className="opacity-70 hover:opacity-100">
                <Info className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs text-xs">{tooltip}</TooltipContent>
          </Tooltip>
        </div>
        <div className="text-2xl font-bold tabular-nums">{value}</div>
      </CardContent>
    </Card>
  );
}
