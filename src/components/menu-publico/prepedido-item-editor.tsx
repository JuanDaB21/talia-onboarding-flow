import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Minus, Plus } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  agregarItemPrepedido,
  editarItemPrepedido,
  getOpcionesProductoPublico,
  type PrepedidoItem,
} from "@/lib/prepedido.functions";
import type { MenuTheme } from "@/lib/menu-themes";

const fmt = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

interface Producto {
  id_producto: string;
  nombre_producto: string;
  precio_venta: number;
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  idMesa: string;
  idSesion: string;
  idCliente: string;
  producto: Producto | null;
  editing?: PrepedidoItem | null;
  themeStyle: React.CSSProperties;
  theme: MenuTheme;
}

export function PrepedidoItemEditor({
  open,
  onOpenChange,
  idMesa,
  idSesion,
  idCliente,
  producto,
  editing,
  themeStyle,
  theme,
}: Props) {
  void theme;
  const qc = useQueryClient();
  const getOps = useServerFn(getOpcionesProductoPublico);
  const addFn = useServerFn(agregarItemPrepedido);
  const editFn = useServerFn(editarItemPrepedido);

  const idProducto = editing?.id_producto ?? producto?.id_producto ?? null;
  const precioBase = editing?.precio_unitario ?? producto?.precio_venta ?? 0;
  const nombreProducto = editing?.nombre_producto ?? producto?.nombre_producto ?? "";

  const [cantidad, setCantidad] = useState(1);
  const [alergia, setAlergia] = useState(false);
  const [nota, setNota] = useState("");
  const [extras, setExtras] = useState<Set<string>>(new Set());
  const [exclus, setExclus] = useState<Set<string>>(new Set());
  // Map: id_grupo -> Set de id_opcion seleccionados
  const [variantes, setVariantes] = useState<Map<string, Set<string>>>(new Map());

  const { data: ops, isLoading } = useQuery({
    queryKey: ["opcionesPublico", idMesa, idProducto],
    queryFn: () =>
      getOps({ data: { idMesa, idProducto: idProducto! } }),
    enabled: !!idProducto && open,
  });

  // Inicializar al abrir
  useEffect(() => {
    if (!open) return;
    if (editing) {
      setCantidad(editing.cantidad);
      setAlergia(editing.tiene_alergia);
      setNota(editing.nota ?? "");
      setExtras(new Set(editing.extras.map((e) => e.id_insumo_extra)));
      setExclus(new Set(editing.exclusiones.map((e) => e.id_insumo)));
      const vm = new Map<string, Set<string>>();
      for (const v of editing.variantes) {
        const s = vm.get(v.id_grupo) ?? new Set<string>();
        s.add(v.id_opcion);
        vm.set(v.id_grupo, s);
      }
      setVariantes(vm);
    } else {
      setCantidad(1);
      setAlergia(false);
      setNota("");
      setExtras(new Set());
      setExclus(new Set());
      setVariantes(new Map());
    }
  }, [open, editing]);

  const variantesArr = useMemo(() => {
    const out: { id_opcion: string }[] = [];
    variantes.forEach((set) => set.forEach((id) => out.push({ id_opcion: id })));
    return out;
  }, [variantes]);

  const total = useMemo(() => {
    const extrasSum = (ops?.extras ?? [])
      .filter((e) => extras.has(e.id_insumo_extra as string))
      .reduce((a, e) => a + Number(e.precio_extra), 0);
    const variantesSum = (ops?.variantes ?? []).reduce((acc, g) => {
      const sel = variantes.get(g.id_grupo);
      if (!sel) return acc;
      return (
        acc +
        g.opciones
          .filter((o) => sel.has(o.id_opcion))
          .reduce((a, o) => a + o.precio_delta, 0)
      );
    }, 0);
    return cantidad * (precioBase + extrasSum + variantesSum);
  }, [ops, extras, variantes, cantidad, precioBase]);

  const mut = useMutation({
    mutationFn: () => {
      if (editing) {
        return editFn({
          data: {
            idItem: editing.id_prepedido_item,
            idCliente,
            cantidad,
            tieneAlergia: alergia,
            nota,
            extras: Array.from(extras).map((id) => ({ id_insumo_extra: id })),
            exclusiones: Array.from(exclus).map((id) => ({ id_insumo: id })),
            variantes: variantesArr,
          },
        });
      }
      return addFn({
        data: {
          idMesa,
          idSesion,
          idCliente,
          idProducto: idProducto!,
          cantidad,
          tieneAlergia: alergia,
          nota,
          extras: Array.from(extras).map((id) => ({ id_insumo_extra: id })),
          exclusiones: Array.from(exclus).map((id) => ({ id_insumo: id })),
          variantes: variantesArr,
        },
      });
    },
    onSuccess: () => {
      toast.success(editing ? "Producto actualizado" : "Agregado al carrito");
      qc.invalidateQueries({ queryKey: ["prepedido", idMesa] });
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
      const prev = n.get(idGrupo) ?? new Set<string>();
      const next = new Set(prev);
      if (seleccion === "UNICA") {
        if (next.has(idOpcion)) {
          next.delete(idOpcion);
        } else {
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
      <SheetContent
        side="bottom"
        className="h-[92vh] overflow-y-auto p-0 border-0"
        style={{
          ...themeStyle,
          background: "var(--menu-bg)",
          color: "var(--menu-foreground)",
          fontFamily: "var(--menu-body-font)",
        }}
      >
        <SheetHeader className="px-5 pt-5 text-left">
          <SheetTitle
            className="text-xl font-bold"
            style={{ fontFamily: "var(--menu-heading-font)" }}
          >
            {nombreProducto}
          </SheetTitle>
          <SheetDescription style={{ color: "var(--menu-muted)" }}>
            Personaliza tu pedido como lo prefieras.
          </SheetDescription>
        </SheetHeader>

        <div className="px-5 py-5 space-y-6">
          {/* Cantidad */}
          <section className="space-y-2">
            <h3 className="text-sm font-semibold uppercase tracking-wider"
              style={{ color: "var(--menu-muted)" }}>
              Cantidad
            </h3>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setCantidad((c) => Math.max(1, c - 1))}
                className="h-11 w-11 rounded-full flex items-center justify-center"
                style={{
                  background: "var(--menu-surface)",
                  border: "1px solid var(--menu-border)",
                }}
                aria-label="Disminuir"
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="text-2xl font-bold tabular-nums w-10 text-center">
                {cantidad}
              </span>
              <button
                type="button"
                onClick={() => setCantidad((c) => Math.min(50, c + 1))}
                className="h-11 w-11 rounded-full flex items-center justify-center"
                style={{
                  background: "var(--menu-primary)",
                  color: "var(--menu-primary-foreground)",
                }}
                aria-label="Aumentar"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </section>

          {/* Alergia */}
          <section
            className="rounded-2xl p-4 flex items-center justify-between gap-3"
            style={{
              background: "var(--menu-surface)",
              border: "1px solid var(--menu-border)",
              borderRadius: "var(--menu-radius)",
            }}
          >
            <div className="min-w-0">
              <p className="font-semibold text-sm">¿Tienes alguna alergia?</p>
              <p className="text-xs" style={{ color: "var(--menu-muted)" }}>
                Avisaremos a la cocina para extremar precauciones.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setAlergia((a) => !a)}
              className="h-7 w-12 rounded-full transition-colors shrink-0 relative"
              style={{
                background: alergia ? "var(--menu-primary)" : "var(--menu-surface-2)",
              }}
              aria-pressed={alergia}
              aria-label="Alergia"
            >
              <span
                className="absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all"
                style={{ left: alergia ? "calc(100% - 1.625rem)" : "0.125rem" }}
              />
            </button>
          </section>

          {/* Extras */}
          {isLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin" style={{ color: "var(--menu-muted)" }} />
            </div>
          ) : (
            <>
              {(ops?.variantes ?? []).map((g) => {
                const sel = variantes.get(g.id_grupo) ?? new Set<string>();
                return (
                  <section key={g.id_grupo} className="space-y-2">
                    <h3
                      className="text-sm font-semibold uppercase tracking-wider"
                      style={{ color: "var(--menu-muted)" }}
                    >
                      {g.nombre}
                      <span className="ml-2 text-[10px] normal-case opacity-70">
                        {g.seleccion === "UNICA" ? "Elige 1" : "Puedes elegir varias"}
                      </span>
                    </h3>
                    <div className="space-y-2">
                      {g.opciones.map((o) => {
                        const checked = sel.has(o.id_opcion);
                        return (
                          <button
                            key={o.id_opcion}
                            type="button"
                            onClick={() => toggleVariante(g.id_grupo, o.id_opcion, g.seleccion)}
                            className="w-full flex items-center justify-between gap-3 p-3 text-left transition-colors"
                            style={{
                              background: checked
                                ? "color-mix(in oklab, var(--menu-primary) 12%, var(--menu-surface))"
                                : "var(--menu-surface)",
                              border: `1px solid ${
                                checked ? "var(--menu-primary)" : "var(--menu-border)"
                              }`,
                              borderRadius: "var(--menu-radius)",
                            }}
                          >
                            <span className="min-w-0 flex-1">
                              <span className="block font-medium text-sm">
                                {o.nombre_opcion}
                              </span>
                              {o.cantidad_porcion > 0 && (
                                <span
                                  className="block text-xs mt-0.5"
                                  style={{ color: "var(--menu-muted)" }}
                                >
                                  {o.cantidad_porcion} {o.unidad_receta}
                                </span>
                              )}
                            </span>
                            {o.precio_delta > 0 && (
                              <span
                                className="text-sm font-semibold tabular-nums shrink-0"
                                style={{ color: "var(--menu-primary)" }}
                              >
                                +{fmt.format(o.precio_delta)}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </section>
                );
              })}

              {(ops?.extras?.length ?? 0) > 0 && (
                <section className="space-y-2">
                  <h3 className="text-sm font-semibold uppercase tracking-wider"
                    style={{ color: "var(--menu-muted)" }}>
                    Extras
                  </h3>
                  <div className="space-y-2">
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
                          className="w-full flex items-center justify-between gap-3 p-3 text-left transition-colors"
                          style={{
                            background: checked
                              ? "color-mix(in oklab, var(--menu-primary) 12%, var(--menu-surface))"
                              : "var(--menu-surface)",
                            border: `1px solid ${
                              checked ? "var(--menu-primary)" : "var(--menu-border)"
                            }`,
                            borderRadius: "var(--menu-radius)",
                          }}
                        >
                          <span className="font-medium text-sm">{nombre}</span>
                          <span className="text-sm font-semibold tabular-nums"
                            style={{ color: "var(--menu-primary)" }}>
                            +{fmt.format(Number(e.precio_extra))}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </section>
              )}

              {(ops?.ingredientes?.length ?? 0) > 0 && (
                <section className="space-y-2">
                  <h3 className="text-sm font-semibold uppercase tracking-wider"
                    style={{ color: "var(--menu-muted)" }}>
                    Quitar ingredientes
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {ops!.ingredientes.map((ing) => {
                      const id = ing.id_insumo as string;
                      const off = exclus.has(id);
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      const nombre = ((ing as any).insumos?.nombre_insumo as string) ?? "—";
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => toggleExcl(id)}
                          className="px-3 py-1.5 text-sm transition-colors"
                          style={{
                            background: off ? "var(--menu-primary)" : "var(--menu-surface)",
                            color: off ? "var(--menu-primary-foreground)" : "var(--menu-foreground)",
                            border: `1px solid ${off ? "var(--menu-primary)" : "var(--menu-border)"}`,
                            borderRadius: "999px",
                            textDecoration: off ? "line-through" : "none",
                          }}
                        >
                          {nombre}
                        </button>
                      );
                    })}
                  </div>
                </section>
              )}
            </>
          )}

          {/* Nota */}
          <section className="space-y-2">
            <h3 className="text-sm font-semibold uppercase tracking-wider"
              style={{ color: "var(--menu-muted)" }}>
              Nota para el chef
            </h3>
            <textarea
              value={nota}
              onChange={(e) => setNota(e.target.value.slice(0, 300))}
              placeholder="Ej. sin sal, término medio…"
              rows={3}
              className="w-full p-3 text-sm resize-none focus:outline-none"
              style={{
                background: "var(--menu-surface)",
                border: "1px solid var(--menu-border)",
                borderRadius: "var(--menu-radius)",
                color: "var(--menu-foreground)",
              }}
            />
          </section>
        </div>

        {/* Footer pegajoso */}
        <div
          className="sticky bottom-0 inset-x-0 p-4 backdrop-blur"
          style={{
            background: "color-mix(in oklab, var(--menu-bg) 92%, transparent)",
            borderTop: "1px solid var(--menu-border)",
            paddingBottom: "calc(env(safe-area-inset-bottom) + 1rem)",
          }}
        >
          <button
            type="button"
            disabled={mut.isPending || !idProducto}
            onClick={() => mut.mutate()}
            className="w-full h-14 font-semibold flex items-center justify-center gap-2 text-base disabled:opacity-60"
            style={{
              background: "var(--menu-primary)",
              color: "var(--menu-primary-foreground)",
              borderRadius: "var(--menu-radius)",
            }}
          >
            {mut.isPending ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Plus className="h-5 w-5" />
            )}
            {editing ? "Guardar cambios" : "Agregar al carrito"} · {fmt.format(total)}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
