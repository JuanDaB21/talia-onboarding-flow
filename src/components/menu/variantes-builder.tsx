import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2, ChevronDown, ChevronUp, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  listarVariantesReceta,
  guardarVariantesReceta,
  listarInsumosParaVariantes,
  type VarianteGrupo,
} from "@/lib/variantes.functions";

type OpcionEditable = {
  id_insumo_opcion: string;
  cantidad_porcion: number;
  precio_delta: number;
};

type GrupoEditable = {
  nombre: string;
  seleccion: "UNICA" | "MULTIPLE";
  opciones: OpcionEditable[];
};

function fromServer(g: VarianteGrupo): GrupoEditable {
  return {
    nombre: g.nombre,
    seleccion: g.seleccion,
    opciones: g.opciones.map((o) => ({
      id_insumo_opcion: o.id_insumo_opcion,
      cantidad_porcion: o.cantidad_porcion,
      precio_delta: o.precio_delta,
    })),
  };
}

export function VariantesBuilder({ idReceta }: { idReceta: string }) {
  const qc = useQueryClient();
  const listFn = useServerFn(listarVariantesReceta);
  const saveFn = useServerFn(guardarVariantesReceta);
  const insumosFn = useServerFn(listarInsumosParaVariantes);

  const variantesQ = useQuery({
    queryKey: ["variantesReceta", idReceta],
    queryFn: () => listFn({ data: { idReceta } }),
  });

  const insumosQ = useQuery({
    queryKey: ["insumosParaVariantes"],
    queryFn: () => insumosFn(),
  });

  const [grupos, setGrupos] = useState<GrupoEditable[]>([]);
  const [expanded, setExpanded] = useState<Set<number>>(new Set([0]));

  useEffect(() => {
    if (variantesQ.data) setGrupos(variantesQ.data.map(fromServer));
  }, [variantesQ.data]);

  const insumos = useMemo(() => insumosQ.data ?? [], [insumosQ.data]);
  const insumosById = useMemo(() => {
    const m = new Map<string, { nombre_insumo: string; unidad_receta: string }>();
    for (const i of insumos) m.set(i.id_insumo, i);
    return m;
  }, [insumos]);

  const saveMut = useMutation({
    mutationFn: () =>
      saveFn({
        data: {
          idReceta,
          grupos: grupos.map((g, gi) => ({
            nombre: g.nombre,
            seleccion: g.seleccion,
            orden: gi,
            opciones: g.opciones.map((o, oi) => ({
              id_insumo_opcion: o.id_insumo_opcion,
              cantidad_porcion: o.cantidad_porcion,
              precio_delta: o.precio_delta,
              orden: oi,
            })),
          })),
        },
      }),
    onSuccess: () => {
      toast.success("Variantes guardadas");
      qc.invalidateQueries({ queryKey: ["variantesReceta", idReceta] });
    },
    onError: (e) =>
      toast.error("No se pudo guardar", {
        description: e instanceof Error ? e.message : undefined,
      }),
  });

  function addGrupo() {
    setGrupos((gs) => [
      ...gs,
      {
        nombre: "",
        seleccion: "UNICA",
        opciones: [{ id_insumo_opcion: "", cantidad_porcion: 1, precio_delta: 0 }],
      },
    ]);
    setExpanded((s) => new Set([...s, grupos.length]));
  }

  function removeGrupo(idx: number) {
    setGrupos((gs) => gs.filter((_, i) => i !== idx));
  }

  function updateGrupo(idx: number, patch: Partial<GrupoEditable>) {
    setGrupos((gs) => gs.map((g, i) => (i === idx ? { ...g, ...patch } : g)));
  }

  function addOpcion(gi: number) {
    setGrupos((gs) =>
      gs.map((g, i) =>
        i === gi
          ? {
              ...g,
              opciones: [
                ...g.opciones,
                { id_insumo_opcion: "", cantidad_porcion: 1, precio_delta: 0 },
              ],
            }
          : g,
      ),
    );
  }

  function updateOpcion(gi: number, oi: number, patch: Partial<OpcionEditable>) {
    setGrupos((gs) =>
      gs.map((g, i) =>
        i === gi
          ? { ...g, opciones: g.opciones.map((o, j) => (j === oi ? { ...o, ...patch } : o)) }
          : g,
      ),
    );
  }

  function removeOpcion(gi: number, oi: number) {
    setGrupos((gs) =>
      gs.map((g, i) => (i === gi ? { ...g, opciones: g.opciones.filter((_, j) => j !== oi) } : g)),
    );
  }

  if (variantesQ.isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Permite que el cliente elija con qué viene este producto (ej. tipo de papa). Cada opción
        consume un insumo del inventario y puede sumar un valor extra.
      </p>

      {grupos.length === 0 && (
        <div className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
          No hay grupos de variantes.
        </div>
      )}

      <div className="space-y-3">
        {grupos.map((g, gi) => {
          const open = expanded.has(gi);
          return (
            <div key={gi} className="rounded-md border bg-card">
              <div className="flex items-center gap-2 p-3">
                <button
                  type="button"
                  className="p-1"
                  onClick={() =>
                    setExpanded((s) => {
                      const n = new Set(s);
                      if (n.has(gi)) n.delete(gi);
                      else n.add(gi);
                      return n;
                    })
                  }
                  aria-label={open ? "Colapsar" : "Expandir"}
                >
                  {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
                <Input
                  value={g.nombre}
                  onChange={(e) => updateGrupo(gi, { nombre: e.target.value })}
                  placeholder="Nombre del grupo (ej. Tipo de papa)"
                  className="flex-1"
                />
                <Select
                  value={g.seleccion}
                  onValueChange={(v) =>
                    updateGrupo(gi, { seleccion: v as "UNICA" | "MULTIPLE" })
                  }
                >
                  <SelectTrigger className="w-[130px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="UNICA">Única</SelectItem>
                    <SelectItem value="MULTIPLE">Múltiple</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="text-destructive"
                  onClick={() => removeGrupo(gi)}
                  aria-label="Eliminar grupo"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              {open && (
                <div className="border-t p-3 space-y-2">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                    Opciones
                  </Label>
                  {g.opciones.map((o, oi) => {
                    const ins = insumosById.get(o.id_insumo_opcion);
                    const unidad = ins?.unidad_receta ?? "";
                    return (
                      <div key={oi} className="grid grid-cols-[1fr_110px_110px_auto] gap-2 items-end">
                        <div className="space-y-1">
                          {oi === 0 && <Label className="text-xs">Insumo</Label>}
                          <Select
                            value={o.id_insumo_opcion || undefined}
                            onValueChange={(v) =>
                              updateOpcion(gi, oi, { id_insumo_opcion: v })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Selecciona un insumo" />
                            </SelectTrigger>
                            <SelectContent>
                              {insumos.map((p) => (
                                <SelectItem key={p.id_insumo} value={p.id_insumo}>
                                  {p.nombre_insumo}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          {oi === 0 && (
                            <Label className="text-xs">Porción {unidad ? `(${unidad})` : ""}</Label>
                          )}
                          <Input
                            type="number"
                            min={0.0001}
                            step="any"
                            value={o.cantidad_porcion}
                            onChange={(e) =>
                              updateOpcion(gi, oi, {
                                cantidad_porcion: Number(e.target.value || 0),
                              })
                            }
                          />
                        </div>
                        <div className="space-y-1">
                          {oi === 0 && <Label className="text-xs">Precio extra</Label>}
                          <div className="relative">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                              +$
                            </span>
                            <Input
                              type="number"
                              min={0}
                              step="any"
                              value={o.precio_delta}
                              onChange={(e) =>
                                updateOpcion(gi, oi, {
                                  precio_delta: Number(e.target.value || 0),
                                })
                              }
                              className="pl-8"
                            />
                          </div>
                        </div>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="text-destructive"
                          onClick={() => removeOpcion(gi, oi)}
                          aria-label="Eliminar opción"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    );
                  })}
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => addOpcion(gi)}
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" /> Agregar opción
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex gap-2">
        <Button type="button" variant="outline" onClick={addGrupo} className="flex-1">
          <Plus className="h-4 w-4 mr-1" /> Agregar grupo
        </Button>
        <Button
          type="button"
          onClick={() => saveMut.mutate()}
          disabled={saveMut.isPending}
          className="flex-1"
        >
          {saveMut.isPending ? (
            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-1" />
          )}
          Guardar variantes
        </Button>
      </div>
    </div>
  );
}
