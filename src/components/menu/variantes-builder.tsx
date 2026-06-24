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
  listarVariantesProducto,
  guardarVariantesProducto,
  listarProductosParaVariantes,
  type VarianteGrupo,
} from "@/lib/variantes.functions";

type GrupoEditable = {
  nombre: string;
  seleccion: "UNICA" | "MULTIPLE";
  opciones: Array<{ id_producto_opcion: string; precio_delta: number }>;
};

function fromServer(g: VarianteGrupo): GrupoEditable {
  return {
    nombre: g.nombre,
    seleccion: g.seleccion,
    opciones: g.opciones.map((o) => ({
      id_producto_opcion: o.id_producto_opcion,
      precio_delta: o.precio_delta,
    })),
  };
}

export function VariantesBuilder({ idProducto }: { idProducto: string }) {
  const qc = useQueryClient();
  const listFn = useServerFn(listarVariantesProducto);
  const saveFn = useServerFn(guardarVariantesProducto);
  const productosFn = useServerFn(listarProductosParaVariantes);

  const variantesQ = useQuery({
    queryKey: ["variantesProducto", idProducto],
    queryFn: () => listFn({ data: { idProducto } }),
  });

  const productosQ = useQuery({
    queryKey: ["productosParaVariantes"],
    queryFn: () => productosFn(),
  });

  const [grupos, setGrupos] = useState<GrupoEditable[]>([]);
  const [expanded, setExpanded] = useState<Set<number>>(new Set([0]));

  useEffect(() => {
    if (variantesQ.data) {
      setGrupos(variantesQ.data.map(fromServer));
    }
  }, [variantesQ.data]);

  const productosDisponibles = useMemo(
    () => (productosQ.data ?? []).filter((p) => p.id_producto !== idProducto),
    [productosQ.data, idProducto],
  );

  const saveMut = useMutation({
    mutationFn: () =>
      saveFn({
        data: {
          idProducto,
          grupos: grupos.map((g, gi) => ({
            nombre: g.nombre,
            seleccion: g.seleccion,
            orden: gi,
            opciones: g.opciones.map((o, oi) => ({
              id_producto_opcion: o.id_producto_opcion,
              precio_delta: o.precio_delta,
              orden: oi,
            })),
          })),
        },
      }),
    onSuccess: () => {
      toast.success("Variantes guardadas");
      qc.invalidateQueries({ queryKey: ["variantesProducto", idProducto] });
    },
    onError: (e) =>
      toast.error("No se pudo guardar", {
        description: e instanceof Error ? e.message : undefined,
      }),
  });

  function addGrupo() {
    setGrupos((gs) => [
      ...gs,
      { nombre: "", seleccion: "UNICA", opciones: [{ id_producto_opcion: "", precio_delta: 0 }] },
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
          ? { ...g, opciones: [...g.opciones, { id_producto_opcion: "", precio_delta: 0 }] }
          : g,
      ),
    );
  }

  function updateOpcion(
    gi: number,
    oi: number,
    patch: Partial<GrupoEditable["opciones"][number]>,
  ) {
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
        Permite que el cliente elija con qué viene este producto (ej. tipo de papa).
        Cada opción referencia otro producto del menú y puede sumar un valor extra.
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
                  {g.opciones.map((o, oi) => (
                    <div key={oi} className="flex items-center gap-2">
                      <Select
                        value={o.id_producto_opcion || undefined}
                        onValueChange={(v) => updateOpcion(gi, oi, { id_producto_opcion: v })}
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Selecciona un producto" />
                        </SelectTrigger>
                        <SelectContent>
                          {productosDisponibles.map((p) => (
                            <SelectItem key={p.id_producto} value={p.id_producto}>
                              {p.nombre_producto}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="relative w-32">
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
                  ))}
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
