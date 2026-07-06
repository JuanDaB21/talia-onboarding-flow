import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Star, ArrowLeftRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { ResponsiveSheet } from "@/components/ui/responsive-sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useBodegas, type Bodega } from "@/hooks/use-bodegas";
import { useEspacios } from "@/hooks/use-espacios";
import {
  crearBodega,
  renombrarBodega,
  toggleBodega,
  eliminarBodega,
  setBodegaPrincipalEspacio,
  trasladarInventario,
} from "@/lib/bodegas.functions";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";

export const Route = createFileRoute("/_app/bodega/bodegas")({
  head: () => ({ meta: [{ title: "Bodegas — Talia" }] }),
  component: BodegasPage,
});

interface InvRow {
  id_bodega: string;
  id_insumo: string;
  cantidad_actual: number;
  insumos: { nombre_insumo: string; unidad_compra: string; unidad_receta: string };
}

function BodegasPage() {
  const qc = useQueryClient();
  const { bodegas, loading, invalidate } = useBodegas();
  const { espacios } = useEspacios({ soloActivos: true });

  const [editSheet, setEditSheet] = useState<{ open: boolean; editing?: Bodega }>({ open: false });
  const [nombre, setNombre] = useState("");
  const [saving, setSaving] = useState(false);
  const [delTarget, setDelTarget] = useState<Bodega | null>(null);
  const [detail, setDetail] = useState<Bodega | null>(null);
  const [trasladoOpen, setTrasladoOpen] = useState(false);

  // Stock por bodega (consulta única reutilizada)
  const invQuery = useQuery({
    queryKey: ["inventario-bodegas-resumen"],
    queryFn: async (): Promise<InvRow[]> => {
      const { data, error } = await supabase
        .from("inventario_bodega")
        .select(
          "id_bodega, id_insumo, cantidad_actual, insumos!inner(nombre_insumo, unidad_compra, unidad_receta)",
        );
      if (error) throw new Error(error.message);
      return (data as unknown as InvRow[]) ?? [];
    },
    staleTime: 10_000,
  });

  const stockPorBodega = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of invQuery.data ?? []) {
      m.set(r.id_bodega, (m.get(r.id_bodega) ?? 0) + Number(r.cantidad_actual));
    }
    return m;
  }, [invQuery.data]);

  const stockDetail = useMemo(() => {
    if (!detail) return [];
    return (invQuery.data ?? [])
      .filter((r) => r.id_bodega === detail.id_bodega && Number(r.cantidad_actual) !== 0)
      .map((r) => ({
        id_insumo: r.id_insumo,
        nombre: r.insumos?.nombre_insumo ?? "—",
        cantidad: Number(r.cantidad_actual),
        unidad: r.insumos?.unidad_receta ?? "",
      }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [detail, invQuery.data]);

  const refreshAll = async () => {
    await invalidate();
    await qc.invalidateQueries({ queryKey: ["inventario-bodegas-resumen"] });
    await qc.invalidateQueries({ queryKey: ["espacios-trabajo"] });
  };

  const openCreate = () => {
    setNombre("");
    setEditSheet({ open: true });
  };
  const openEdit = (b: Bodega) => {
    setNombre(b.nombre);
    setEditSheet({ open: true, editing: b });
  };

  const handleSave = async () => {
    const trimmed = nombre.trim();
    if (trimmed.length < 2) {
      toast.error("El nombre debe tener al menos 2 caracteres");
      return;
    }
    setSaving(true);
    try {
      if (editSheet.editing) {
        await renombrarBodega({ id_bodega: editSheet.editing.id_bodega, nombre: trimmed });
        toast.success("Bodega actualizada");
      } else {
        await crearBodega({ nombre: trimmed });
        toast.success("Bodega creada");
      }
      setEditSheet({ open: false });
      await refreshAll();
    } catch (e) {
      toast.error("No se pudo guardar", { description: e instanceof Error ? e.message : "Error" });
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (b: Bodega, activa: boolean) => {
    try {
      await toggleBodega({ id_bodega: b.id_bodega, activa });
      await refreshAll();
    } catch (e) {
      toast.error("No se pudo cambiar el estado", {
        description: e instanceof Error ? e.message : "Error",
      });
    }
  };

  const handleDelete = async () => {
    if (!delTarget) return;
    try {
      await eliminarBodega({ id_bodega: delTarget.id_bodega });
      toast.success("Bodega eliminada");
      setDelTarget(null);
      await refreshAll();
    } catch (e) {
      toast.error("No se pudo eliminar", {
        description: e instanceof Error ? e.message : "Error",
      });
    }
  };

  return (
    <div className="space-y-4">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Bodegas</h1>
          <p className="text-sm text-muted-foreground">
            Administra las ubicaciones físicas donde guardas tu inventario.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setTrasladoOpen(true)}>
            <ArrowLeftRight className="h-4 w-4 mr-1" /> Trasladar
          </Button>
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1" /> Nueva bodega
          </Button>
        </div>
      </header>

      {loading ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : bodegas.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Aún no has creado bodegas.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {bodegas.map((b) => {
            const totalStock = stockPorBodega.get(b.id_bodega) ?? 0;
            const esPrincipal = b.espacios_principales.length > 0;
            return (
              <Card
                key={b.id_bodega}
                className="cursor-pointer hover:border-primary/40 transition-colors"
                onClick={() => setDetail(b)}
              >
                <CardContent className="pt-5 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        {esPrincipal && <Star className="h-4 w-4 text-amber-500 fill-amber-400" />}
                        <h3 className="font-semibold truncate">{b.nombre}</h3>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {totalStock.toLocaleString()} unidades en stock
                      </p>
                    </div>
                    {!b.activa && <Badge variant="secondary">Inactiva</Badge>}
                  </div>

                  {b.espacios_principales.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {b.espacios_principales.map((e) => (
                        <Badge key={e.id_espacio} variant="outline" className="text-[11px]">
                          Principal de {e.nombre}
                        </Badge>
                      ))}
                    </div>
                  )}

                  <div
                    className="flex items-center justify-between pt-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center gap-2">
                      <Switch checked={b.activa} onCheckedChange={(v) => handleToggle(b, v)} />
                      <span className="text-xs text-muted-foreground">
                        {b.activa ? "Activa" : "Inactiva"}
                      </span>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(b)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDelTarget(b)}
                        disabled={esPrincipal}
                        title={esPrincipal ? "No se puede eliminar mientras sea principal" : ""}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Crear / editar */}
      <ResponsiveSheet
        open={editSheet.open}
        onOpenChange={(open) =>
          setEditSheet({ open, editing: open ? editSheet.editing : undefined })
        }
        title={editSheet.editing ? "Editar bodega" : "Nueva bodega"}
        description="Define el nombre con el que aparecerá en el sistema."
      >
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="nombre">Nombre</Label>
            <Input
              id="nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Bodega Piso 11"
              autoFocus
            />
          </div>
          <div className="flex flex-col sm:flex-row gap-2 pt-2">
            <Button
              variant="outline"
              className="w-full sm:flex-1"
              onClick={() => setEditSheet({ open: false })}
            >
              Cancelar
            </Button>
            <Button className="w-full sm:flex-1" onClick={handleSave} disabled={saving}>
              {saving ? "Guardando…" : "Guardar"}
            </Button>
          </div>
        </div>
      </ResponsiveSheet>

      {/* Detalle bodega */}
      <ResponsiveSheet
        open={!!detail}
        onOpenChange={(open) => !open && setDetail(null)}
        title={detail?.nombre ?? ""}
        description="Stock disponible y asignación a espacios de trabajo."
      >
        {detail && (
          <div className="space-y-5">
            <section>
              <h4 className="text-sm font-semibold mb-2">Principal de</h4>
              <div className="space-y-2">
                {espacios.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No hay espacios activos.</p>
                ) : (
                  espacios.map((e) => {
                    const checked = detail.espacios_principales.some(
                      (x) => x.id_espacio === e.id_espacio,
                    );
                    return (
                      <div
                        key={e.id_espacio}
                        className="flex items-center justify-between rounded-md border px-3 py-2"
                      >
                        <span className="text-sm">{e.nombre}</span>
                        <Switch
                          checked={checked}
                          onCheckedChange={async (v) => {
                            if (v) {
                              try {
                                await setBodegaPrincipalEspacio({
                                  id_espacio: e.id_espacio,
                                  id_bodega: detail.id_bodega,
                                });
                                toast.success(`Asignada como principal de ${e.nombre}`);
                                await refreshAll();
                                // Refresh detail
                                const updated =
                                  (await qc.getQueryData<Bodega[]>(["bodegas"])) ?? [];
                                const next = updated.find((b) => b.id_bodega === detail.id_bodega);
                                if (next) setDetail(next);
                              } catch (err) {
                                toast.error("No se pudo asignar", {
                                  description: err instanceof Error ? err.message : "Error",
                                });
                              }
                            } else {
                              toast.info(
                                "Para quitar, asigna otra bodega como principal de este espacio",
                              );
                            }
                          }}
                        />
                      </div>
                    );
                  })
                )}
              </div>
            </section>

            <section>
              <h4 className="text-sm font-semibold mb-2">Stock</h4>
              {stockDetail.length === 0 ? (
                <p className="text-xs text-muted-foreground">Esta bodega no tiene stock.</p>
              ) : (
                <div className="rounded-md border divide-y">
                  {stockDetail.map((s) => (
                    <div
                      key={s.id_insumo}
                      className="flex items-center justify-between px-3 py-2 text-sm"
                    >
                      <span className="truncate">{s.nombre}</span>
                      <span className="tabular-nums font-medium">
                        {s.cantidad.toLocaleString()} {s.unidad}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </ResponsiveSheet>

      {/* Traslado */}
      <TrasladoDialog
        open={trasladoOpen}
        onOpenChange={setTrasladoOpen}
        bodegas={bodegas.filter((b) => b.activa)}
        invRows={invQuery.data ?? []}
        onDone={refreshAll}
        trasladar={trasladarInventario}
      />

      <AlertDialog open={!!delTarget} onOpenChange={(o) => !o && setDelTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar bodega</AlertDialogTitle>
            <AlertDialogDescription>
              {delTarget?.nombre} se eliminará. Solo es posible si no tiene stock ni es principal de
              ningún espacio.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

interface TrasladoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bodegas: Bodega[];
  invRows: InvRow[];
  onDone: () => Promise<void> | void;
  trasladar: typeof trasladarInventario;
}

function TrasladoDialog({
  open,
  onOpenChange,
  bodegas,
  invRows,
  onDone,
  trasladar,
}: TrasladoDialogProps) {
  const [origen, setOrigen] = useState("");
  const [destino, setDestino] = useState("");
  const [idInsumo, setIdInsumo] = useState("");
  const [cantidad, setCantidad] = useState("");
  const [motivo, setMotivo] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) {
      setOrigen("");
      setDestino("");
      setIdInsumo("");
      setCantidad("");
      setMotivo("");
    }
  }, [open]);

  const insumosOrigen = useMemo(() => {
    if (!origen) return [];
    const map = new Map<string, { nombre: string; cantidad: number; unidad: string }>();
    for (const r of invRows) {
      if (r.id_bodega !== origen) continue;
      if (Number(r.cantidad_actual) <= 0) continue;
      map.set(r.id_insumo, {
        nombre: r.insumos?.nombre_insumo ?? "—",
        cantidad: Number(r.cantidad_actual),
        unidad: r.insumos?.unidad_receta ?? "",
      });
    }
    return Array.from(map.entries()).map(([id, v]) => ({ id_insumo: id, ...v }));
  }, [invRows, origen]);

  const insumoOpts: ComboboxOption[] = useMemo(
    () =>
      insumosOrigen.map((i) => ({
        value: i.id_insumo,
        label: i.nombre,
        hint: `${i.cantidad.toLocaleString()} ${i.unidad}`,
      })),
    [insumosOrigen],
  );

  const stockDisponible = useMemo(() => {
    return insumosOrigen.find((i) => i.id_insumo === idInsumo)?.cantidad ?? 0;
  }, [insumosOrigen, idInsumo]);

  const handleSubmit = async () => {
    if (!origen || !destino || !idInsumo) {
      toast.error("Completa origen, destino e insumo");
      return;
    }
    if (origen === destino) {
      toast.error("La bodega origen y destino deben ser distintas");
      return;
    }
    const c = Number(cantidad);
    if (!c || c <= 0) {
      toast.error("Cantidad inválida");
      return;
    }
    if (c > stockDisponible) {
      toast.error("La cantidad excede el stock disponible");
      return;
    }
    if (!motivo.trim()) {
      toast.error("Indica un motivo");
      return;
    }
    setSaving(true);
    try {
      await trasladar({
        id_insumo: idInsumo,
        id_bodega_origen: origen,
        id_bodega_destino: destino,
        cantidad: c,
        motivo: motivo.trim(),
      });
      toast.success("Traslado registrado");
      onOpenChange(false);
      await onDone();
    } catch (e) {
      toast.error("No se pudo trasladar", {
        description: e instanceof Error ? e.message : "Error",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Trasladar inventario"
      description="Mueve stock entre bodegas. Queda registro de fecha, hora y usuario."
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Bodega origen</Label>
            <Select value={origen} onValueChange={setOrigen}>
              <SelectTrigger>
                <SelectValue placeholder="Origen" />
              </SelectTrigger>
              <SelectContent>
                {bodegas.map((b) => (
                  <SelectItem key={b.id_bodega} value={b.id_bodega}>
                    {b.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Bodega destino</Label>
            <Select value={destino} onValueChange={setDestino}>
              <SelectTrigger>
                <SelectValue placeholder="Destino" />
              </SelectTrigger>
              <SelectContent>
                {bodegas
                  .filter((b) => b.id_bodega !== origen)
                  .map((b) => (
                    <SelectItem key={b.id_bodega} value={b.id_bodega}>
                      {b.nombre}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Insumo</Label>
          <Combobox
            options={insumoOpts}
            value={idInsumo || null}
            onChange={(v) => setIdInsumo(v ?? "")}
            placeholder={origen ? "Selecciona insumo" : "Selecciona primero la bodega origen"}
            searchPlaceholder="Buscar insumo…"
          />
          {idInsumo && (
            <p className="text-xs text-muted-foreground">
              Disponible: {stockDisponible.toLocaleString()}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="t-cant">Cantidad a trasladar</Label>
          <Input
            id="t-cant"
            type="number"
            step="0.0001"
            min="0"
            value={cantidad}
            onChange={(e) => setCantidad(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="t-motivo">Motivo</Label>
          <Input
            id="t-motivo"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Reabastecer barra, conteo físico, …"
          />
        </div>

        <div className="flex flex-col sm:flex-row gap-2 pt-2">
          <Button
            variant="outline"
            className="w-full sm:flex-1"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button className="w-full sm:flex-1" onClick={handleSubmit} disabled={saving}>
            {saving ? "Trasladando…" : "Trasladar"}
          </Button>
        </div>
      </div>
    </ResponsiveSheet>
  );
}
