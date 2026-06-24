import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Minus, Plus, Save } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  editarItemPrepedidoStaff,
  getOpcionesProductoPublico,
  type PrepedidoItem,
} from "@/lib/prepedido.functions";

const fmt = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  idMesa: string;
  item: PrepedidoItem | null;
}

export function PrepedidoItemEditorStaff({ open, onOpenChange, idMesa, item }: Props) {
  const qc = useQueryClient();
  const getOps = useServerFn(getOpcionesProductoPublico);
  const editFn = useServerFn(editarItemPrepedidoStaff);

  const [cantidad, setCantidad] = useState(1);
  const [alergia, setAlergia] = useState(false);
  const [nota, setNota] = useState("");
  const [extras, setExtras] = useState<Set<string>>(new Set());
  const [exclus, setExclus] = useState<Set<string>>(new Set());
  const [variantes, setVariantes] = useState<Map<string, Set<string>>>(new Map());

  const { data: ops, isLoading } = useQuery({
    queryKey: ["opcionesPublico", idMesa, item?.id_producto],
    queryFn: () =>
      getOps({ data: { idMesa, idProducto: item!.id_producto } }),
    enabled: !!item && open,
  });

  useEffect(() => {
    if (!open || !item) return;
    setCantidad(item.cantidad);
    setAlergia(item.tiene_alergia);
    setNota(item.nota ?? "");
    setExtras(new Set(item.extras.map((e) => e.id_insumo_extra)));
    setExclus(new Set(item.exclusiones.map((e) => e.id_insumo)));
    const vm = new Map<string, Set<string>>();
    for (const v of item.variantes) {
      const s = vm.get(v.id_grupo) ?? new Set<string>();
      s.add(v.id_opcion);
      vm.set(v.id_grupo, s);
    }
    setVariantes(vm);
  }, [open, item]);

  const variantesArr = useMemo(() => {
    const out: { id_opcion: string }[] = [];
    variantes.forEach((s) => s.forEach((id) => out.push({ id_opcion: id })));
    return out;
  }, [variantes]);

  const total = useMemo(() => {
    if (!item) return 0;
    const extrasSum = (ops?.extras ?? [])
      .filter((e) => extras.has(e.id_insumo_extra as string))
      .reduce((a, e) => a + Number(e.precio_extra), 0);
    const varSum = (ops?.variantes ?? []).reduce((acc, g) => {
      const sel = variantes.get(g.id_grupo);
      if (!sel) return acc;
      return acc + g.opciones.filter((o) => sel.has(o.id_opcion)).reduce((a, o) => a + o.precio_delta, 0);
    }, 0);
    return cantidad * (item.precio_unitario + extrasSum + varSum);
  }, [ops, extras, variantes, cantidad, item]);

  const mut = useMutation({
    mutationFn: () =>
      editFn({
        data: {
          idItem: item!.id_prepedido_item,
          cantidad,
          tieneAlergia: alergia,
          nota,
          extras: Array.from(extras).map((id) => ({ id_insumo_extra: id })),
          exclusiones: Array.from(exclus).map((id) => ({ id_insumo: id })),
          variantes: variantesArr,
        },
      }),
    onSuccess: () => {
      toast.success("Item actualizado");
      qc.invalidateQueries({ queryKey: ["prepedidoMesa", idMesa] });
      qc.invalidateQueries({ queryKey: ["mesaSesion", idMesa] });
      onOpenChange(false);
    },
    onError: (e) =>
      toast.error("No se pudo guardar", {
        description: e instanceof Error ? e.message : undefined,
      }),
  });

  function toggleExtra(id: string) {
    setExtras((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }
  function toggleExcl(id: string) {
    setExclus((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
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

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{item?.nombre_producto ?? "Editar item"}</SheetTitle>
          <SheetDescription>
            Modifica el item del pre-pedido antes de enviarlo a la comanda.
          </SheetDescription>
        </SheetHeader>

        <div className="py-5 space-y-6">
          {/* Cantidad */}
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
              Cantidad
            </Label>
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setCantidad((c) => Math.max(1, c - 1))}
              >
                <Minus className="h-4 w-4" />
              </Button>
              <span className="text-2xl font-bold tabular-nums w-10 text-center">
                {cantidad}
              </span>
              <Button
                type="button"
                size="icon"
                onClick={() => setCantidad((c) => Math.min(50, c + 1))}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Alergia */}
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Marcar alergia</p>
              <p className="text-xs text-muted-foreground">
                Avisa a cocina para extremar precauciones.
              </p>
            </div>
            <Switch checked={alergia} onCheckedChange={setAlergia} />
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {(ops?.variantes ?? []).map((g) => {
                const sel = variantes.get(g.id_grupo) ?? new Set<string>();
                return (
                  <div key={g.id_grupo} className="space-y-2">
                    <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                      {g.nombre}
                      <span className="ml-2 normal-case opacity-70">
                        {g.seleccion === "UNICA" ? "Elige 1" : "Varias"}
                      </span>
                    </Label>
                    <div className="space-y-1.5">
                      {g.opciones.map((o) => {
                        const checked = sel.has(o.id_opcion);
                        return (
                          <button
                            key={o.id_opcion}
                            type="button"
                            onClick={() => toggleVariante(g.id_grupo, o.id_opcion, g.seleccion)}
                            className={`w-full flex items-center justify-between gap-3 p-3 rounded-md border text-left text-sm transition-colors ${
                              checked
                                ? "border-primary bg-primary/10"
                                : "border-border bg-card hover:bg-muted"
                            }`}
                          >
                            <span className="font-medium">{o.nombre_producto_opcion}</span>
                            {o.precio_delta > 0 && (
                              <span className="font-semibold tabular-nums text-primary">
                                +{fmt.format(o.precio_delta)}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {(ops?.extras?.length ?? 0) > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                    Extras
                  </Label>
                  <div className="space-y-1.5">
                    {ops!.extras.map((e) => {
                      const id = e.id_insumo_extra as string;
                      const checked = extras.has(id);
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      const nombre = ((e as any).insumos?.nombre_insumo as string) ?? "Extra";
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => toggleExtra(id)}
                          className={`w-full flex items-center justify-between gap-3 p-3 rounded-md border text-left text-sm transition-colors ${
                            checked
                              ? "border-primary bg-primary/10"
                              : "border-border bg-card hover:bg-muted"
                          }`}
                        >
                          <span className="font-medium">{nombre}</span>
                          <span className="font-semibold tabular-nums text-primary">
                            +{fmt.format(Number(e.precio_extra))}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {(ops?.ingredientes?.length ?? 0) > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                    Quitar ingredientes
                  </Label>
                  <div className="flex flex-wrap gap-1.5">
                    {ops!.ingredientes.map((ing) => {
                      const id = ing.id_insumo as string;
                      const off = exclus.has(id);
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      const nombre = ((ing as any).insumos?.nombre_insumo as string) ?? "—";
                      return (
                        <Badge
                          key={id}
                          variant={off ? "default" : "outline"}
                          onClick={() => toggleExcl(id)}
                          className={`cursor-pointer ${off ? "line-through" : ""}`}
                        >
                          {nombre}
                        </Badge>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}

          <div className="space-y-2">
            <Label htmlFor="nota-staff" className="text-xs uppercase tracking-wide text-muted-foreground">
              Nota para el chef
            </Label>
            <Textarea
              id="nota-staff"
              value={nota}
              onChange={(e) => setNota(e.target.value.slice(0, 300))}
              placeholder="Ej. sin sal, término medio…"
              rows={3}
            />
          </div>
        </div>

        <SheetFooter className="sticky bottom-0 bg-background pt-3 border-t">
          <div className="w-full space-y-2">
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-muted-foreground">Subtotal</span>
              <span className="text-xl font-bold tabular-nums">{fmt.format(total)}</span>
            </div>
            <Button
              type="button"
              className="w-full"
              disabled={mut.isPending || !item}
              onClick={() => mut.mutate()}
            >
              {mut.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Guardar cambios
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
