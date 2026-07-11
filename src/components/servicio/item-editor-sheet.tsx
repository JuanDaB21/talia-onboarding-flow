import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { agregarItem, getOpcionesProducto } from "@/lib/servicio.functions";

interface Producto {
  id_producto: string;
  nombre_producto: string;
  precio_venta: number;
}

export function ItemEditorSheet({
  open,
  onOpenChange,
  producto,
  idPedido,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  producto: Producto | null;
  idPedido: string;
}) {
  const qc = useQueryClient();

  const [cantidad, setCantidad] = useState(1);
  const [alergia, setAlergia] = useState(false);
  const [nota, setNota] = useState("");
  const [extras, setExtras] = useState<Set<string>>(new Set());
  const [exclus, setExclus] = useState<Set<string>>(new Set());
  const [variantes, setVariantes] = useState<Map<string, Set<string>>>(new Map());

  const { data: ops, isLoading } = useQuery({
    queryKey: ["opcionesProducto", producto?.id_producto],
    queryFn: () => getOpcionesProducto(producto!.id_producto),
    enabled: !!producto && open,
  });

  const variantesArr = useMemo(() => {
    const out: { id_opcion: string }[] = [];
    variantes.forEach((s) => s.forEach((id) => out.push({ id_opcion: id })));
    return out;
  }, [variantes]);

  const mut = useMutation({
    mutationFn: () =>
      agregarItem({
        idPedido,
        idProducto: producto!.id_producto,
        cantidad,
        tieneAlergia: alergia,
        nota,
        extras: Array.from(extras).map((id) => ({ id_insumo_extra: id })),
        exclusiones: Array.from(exclus).map((id) => ({ id_insumo: id })),
        variantes: variantesArr,
      }),
    onSuccess: () => {
      toast.success("Producto agregado");
      qc.invalidateQueries({ queryKey: ["mesaPedido"] });
      qc.invalidateQueries({ queryKey: ["mesaSesion"] });
      reset();
      onOpenChange(false);
    },

    onError: (e) =>
      toast.error("No se pudo agregar", {
        description: e instanceof Error ? e.message : undefined,
      }),
  });

  function reset() {
    setCantidad(1);
    setAlergia(false);
    setNota("");
    setExtras(new Set());
    setExclus(new Set());
    setVariantes(new Map());
  }

  function toggleVariante(idGrupo: string, idOpcion: string, seleccion: "UNICA" | "MULTIPLE") {
    setVariantes((m) => {
      const n = new Map(m);
      const next = new Set(n.get(idGrupo) ?? []);
      if (seleccion === "UNICA") {
        if (next.has(idOpcion)) next.delete(idOpcion);
        else {
          next.clear();
          next.add(idOpcion);
        }
      } else {
        if (next.has(idOpcion)) next.delete(idOpcion);
        else next.add(idOpcion);
      }
      n.set(idGrupo, next);
      return n;
    });
  }

  const total = useMemo(() => {
    if (!producto) return 0;
    const extraSum = (ops?.extras ?? [])
      .filter((e) => extras.has(e.id_insumo_extra))
      .reduce((a, e) => a + Number(e.precio_extra), 0);
    const varSum = (ops?.variantes ?? []).reduce((acc, g) => {
      const sel = variantes.get(g.id_grupo);
      if (!sel) return acc;
      return acc + g.opciones.filter((o) => sel.has(o.id_opcion)).reduce((a, o) => a + o.precio_delta, 0);
    }, 0);
    return cantidad * (producto.precio_venta + extraSum + varSum);
  }, [producto, cantidad, extras, variantes, ops]);

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{producto?.nombre_producto ?? "—"}</SheetTitle>
          <SheetDescription>
            Personaliza el pedido del comensal.
          </SheetDescription>
        </SheetHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="mt-6 space-y-6">
            <div className="flex items-center justify-between">
              <Label>Cantidad</Label>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setCantidad((c) => Math.max(1, c - 1))}
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <span className="w-8 text-center font-semibold">{cantidad}</span>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setCantidad((c) => c + 1)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-destructive/30 bg-destructive/5 p-3">
              <div className="space-y-0.5">
                <Label className="text-destructive font-semibold">
                  🚨 Marcar alergia
                </Label>
                <p className="text-xs text-muted-foreground">
                  Cocina tomará precauciones estrictas.
                </p>
              </div>
              <Switch checked={alergia} onCheckedChange={setAlergia} />
            </div>

            {(ops?.variantes ?? []).map((g) => {
              const sel = variantes.get(g.id_grupo) ?? new Set<string>();
              return (
                <div key={g.id_grupo} className="space-y-2">
                  <Label>
                    {g.nombre}
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      {g.seleccion === "UNICA" ? "Elige 1" : "Puedes elegir varias"}
                    </span>
                  </Label>
                  <div className="space-y-1.5 rounded-lg border p-2">
                    {g.opciones.map((o) => {
                      const checked = sel.has(o.id_opcion);
                      return (
                        <button
                          key={o.id_opcion}
                          type="button"
                          onClick={() => toggleVariante(g.id_grupo, o.id_opcion, g.seleccion)}
                          className={`w-full flex items-center justify-between gap-2 p-2 rounded-md border text-left text-sm transition-colors ${
                            checked
                              ? "border-primary bg-primary/10"
                              : "border-border bg-card hover:bg-muted"
                          }`}
                        >
                          <span className="font-medium">{o.nombre_opcion}</span>
                          {o.precio_delta > 0 && (
                            <span className="text-xs font-semibold tabular-nums text-primary">
                              +${o.precio_delta.toLocaleString("es-CO")}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {(ops?.extras.length ?? 0) > 0 && (
              <div className="space-y-2">
                <Label>Agregar extras</Label>
                <div className="space-y-2 rounded-lg border p-3">
                  {ops!.extras.map((e) => {
                    return (
                      <label
                        key={e.id_insumo_extra}
                        className="flex items-center justify-between gap-2 cursor-pointer"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <Checkbox
                            checked={extras.has(e.id_insumo_extra)}
                            onCheckedChange={(v) => {
                              const next = new Set(extras);
                              if (v) next.add(e.id_insumo_extra);
                              else next.delete(e.id_insumo_extra);
                              setExtras(next);
                            }}
                          />
                          <span className="text-sm truncate">
                            {e.nombre_insumo}
                          </span>
                        </div>
                        <span className="text-xs font-medium tabular-nums">
                          +{Number(e.precio_extra).toLocaleString("es-CO")}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            {(ops?.permite_quitar_ingredientes ?? true) && (ops?.ingredientes.length ?? 0) > 0 && (
              <div className="space-y-2">
                <Label>Quitar ingredientes</Label>
                <div className="space-y-2 rounded-lg border p-3">
                  {ops!.ingredientes.map((i) => {
                    return (
                      <label
                        key={i.id_insumo}
                        className="flex items-center gap-2 cursor-pointer"
                      >
                        <Checkbox
                          checked={exclus.has(i.id_insumo)}
                          onCheckedChange={(v) => {
                            const next = new Set(exclus);
                            if (v) next.add(i.id_insumo);
                            else next.delete(i.id_insumo);
                            setExclus(next);
                          }}
                        />
                        <span className="text-sm">Sin {i.nombre_insumo}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="nota">Nota</Label>
              <Textarea
                id="nota"
                value={nota}
                onChange={(e) => setNota(e.target.value)}
                placeholder="Ej. término medio, sin sal…"
                rows={2}
              />
            </div>

            <div className="rounded-lg bg-muted p-3 flex items-center justify-between">
              <span className="text-sm">Subtotal</span>
              <span className="text-lg font-bold tabular-nums">
                ${total.toLocaleString("es-CO")}
              </span>
            </div>

            <Button
              className="w-full h-12"
              onClick={() => mut.mutate()}
              disabled={mut.isPending}
            >
              {mut.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Agregar al pedido"
              )}
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
