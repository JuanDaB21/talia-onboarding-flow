import { useMemo } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Pencil, Trash2, AlertTriangle } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  eliminarItemPrepedido,
  type PrepedidoData,
  type PrepedidoItem,
} from "@/lib/prepedido.functions";
import type { MenuTheme } from "@/lib/menu-themes";

const fmt = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  idMesa: string;
  idCliente: string;
  idSesion: string;
  data: PrepedidoData | null;
  loading: boolean;
  themeStyle: React.CSSProperties;
  theme: MenuTheme;
  onEdit?: (item: PrepedidoItem) => void;
}

export function PrepedidoSheet({
  open,
  onOpenChange,
  idMesa,
  idCliente,
  idSesion,
  data,
  loading,
  themeStyle,
  theme,
  onEdit,
}: Props) {
  void theme;
  void idSesion;
  const qc = useQueryClient();
  const delFn = useServerFn(eliminarItemPrepedido);
  

  const delMut = useMutation({
    mutationFn: (idItem: string) => delFn({ data: { idItem, idCliente } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["prepedido", idMesa] });
      toast.success("Eliminado");
    },
    onError: (e) =>
      toast.error("No se pudo eliminar", {
        description: e instanceof Error ? e.message : undefined,
      }),
  });

  const grupos = useMemo(() => {
    if (!data) return [];
    const bySesion = new Map<string, PrepedidoItem[]>();
    for (const it of data.items) {
      const arr = bySesion.get(it.id_sesion) ?? [];
      arr.push(it);
      bySesion.set(it.id_sesion, arr);
    }
    const todos = data.sesiones
      .map((s) => ({ sesion: s, items: bySesion.get(s.id_sesion) ?? [] }))
      .filter((g) => g.items.length > 0);
    // Poner "tú" siempre primero para que el cliente vea lo suyo de entrada
    todos.sort((a, b) => {
      const ap = a.sesion.id_cliente === idCliente ? 0 : 1;
      const bp = b.sesion.id_cliente === idCliente ? 0 : 1;
      return ap - bp;
    });
    return todos;
  }, [data, idCliente]);

  return (
    <>
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
              Pedido de la mesa
            </SheetTitle>
            <SheetDescription style={{ color: "var(--menu-muted)" }}>
              Lo que tú y tus acompañantes están armando. Solo puedes editar lo tuyo.
            </SheetDescription>
          </SheetHeader>

          <div className="px-5 py-4 pb-40 space-y-5">
            {loading && !data ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-5 w-5 animate-spin"
                  style={{ color: "var(--menu-muted)" }} />
              </div>
            ) : grupos.length === 0 ? (
              <div
                className="text-center py-12 px-4"
                style={{ color: "var(--menu-muted)" }}
              >
                <p className="text-sm">
                  Aún no hay nada en el carrito. Toca un producto del menú para agregarlo.
                </p>
              </div>
            ) : (
              grupos.map(({ sesion, items }) => {
                const propio = sesion.id_cliente === idCliente;
                const inicial = sesion.nombre.charAt(0).toUpperCase();
                return (
                  <section key={sesion.id_sesion} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div
                        className="h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold"
                        style={{
                          background: propio
                            ? "var(--menu-primary)"
                            : "var(--menu-surface-2)",
                          color: propio
                            ? "var(--menu-primary-foreground)"
                            : "var(--menu-foreground)",
                        }}
                      >
                        {inicial}
                      </div>
                      <p className="text-sm font-semibold">
                        {sesion.nombre} {propio && (
                          <span className="text-xs font-normal"
                            style={{ color: "var(--menu-muted)" }}>
                            (tú)
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="space-y-2">
                      {items.map((it) => (
                        <article
                          key={it.id_prepedido_item}
                          className="p-3 space-y-2"
                          style={{
                            background: "var(--menu-surface)",
                            border: "1px solid var(--menu-border)",
                            borderRadius: "var(--menu-radius)",
                          }}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <p className="font-semibold text-sm leading-snug">
                                <span className="tabular-nums">{it.cantidad}× </span>
                                {it.nombre_producto}
                              </p>
                              {it.tiene_alergia && (
                                <p className="text-xs mt-1 inline-flex items-center gap-1"
                                  style={{ color: "var(--menu-primary)" }}>
                                  <AlertTriangle className="h-3 w-3" /> alergia
                                </p>
                              )}
                              {it.extras.length > 0 && (
                                <p className="text-xs mt-1"
                                  style={{ color: "var(--menu-muted)" }}>
                                  + {it.extras.map((e) => e.nombre).join(", ")}
                                </p>
                              )}
                              {it.exclusiones.length > 0 && (
                                <p className="text-xs mt-1"
                                  style={{ color: "var(--menu-muted)" }}>
                                  Sin: {it.exclusiones.map((x) => x.nombre).join(", ")}
                                </p>
                              )}
                              {it.nota && (
                                <p className="text-xs mt-1 italic"
                                  style={{ color: "var(--menu-muted)" }}>
                                  “{it.nota}”
                                </p>
                              )}
                            </div>
                            <p className="text-sm font-bold tabular-nums shrink-0">
                              {fmt.format(it.subtotal)}
                            </p>
                          </div>
                          {propio && (
                            <div className="flex gap-2 pt-1">
                              <button
                                type="button"
                                onClick={() => onEdit?.(it)}
                                className="flex-1 h-9 text-xs font-semibold flex items-center justify-center gap-1.5"
                                style={{
                                  background: "var(--menu-surface-2)",
                                  borderRadius: "calc(var(--menu-radius) * 0.7)",
                                }}
                              >
                                <Pencil className="h-3.5 w-3.5" /> Editar
                              </button>
                              <button
                                type="button"
                                disabled={delMut.isPending}
                                onClick={() => delMut.mutate(it.id_prepedido_item)}
                                className="flex-1 h-9 text-xs font-semibold flex items-center justify-center gap-1.5 disabled:opacity-60"
                                style={{
                                  background: "color-mix(in oklab, red 12%, var(--menu-surface-2))",
                                  color: "rgb(190 0 0)",
                                  borderRadius: "calc(var(--menu-radius) * 0.7)",
                                }}
                              >
                                <Trash2 className="h-3.5 w-3.5" /> Quitar
                              </button>
                            </div>
                          )}
                        </article>
                      ))}
                    </div>
                  </section>
                );
              })
            )}
          </div>

          {data && data.items.length > 0 && (
            <div
              className="sticky bottom-0 inset-x-0 px-5 py-4 backdrop-blur"
              style={{
                background: "color-mix(in oklab, var(--menu-bg) 92%, transparent)",
                borderTop: "1px solid var(--menu-border)",
                paddingBottom: "calc(env(safe-area-inset-bottom) + 1rem)",
              }}
            >
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-medium"
                  style={{ color: "var(--menu-muted)" }}>
                  Total parcial
                </span>
                <span className="text-2xl font-bold tabular-nums">
                  {fmt.format(data.total)}
                </span>
              </div>
              <p className="text-xs mt-2"
                style={{ color: "var(--menu-muted)" }}>
                Tu mesero confirmará el pedido antes de enviarlo a cocina.
              </p>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
