import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ImageIcon,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  obtenerMesaPedido,
  getCatalogoServicio,
  eliminarItem,
  confirmarPedido,
} from "@/lib/servicio.functions";
import { ItemEditorSheet } from "@/components/servicio/item-editor-sheet";

export const Route = createFileRoute("/_app/servicio/$idMesa")({
  head: () => ({ meta: [{ title: "Toma de pedido" }] }),
  component: TomaPedido,
});

const fmt = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

function TomaPedido() {
  const { idMesa } = Route.useParams();
  const qc = useQueryClient();

  const getMesa = useServerFn(obtenerMesaPedido);
  const getCat = useServerFn(getCatalogoServicio);
  const delFn = useServerFn(eliminarItem);
  const confFn = useServerFn(confirmarPedido);

  const mesaQ = useQuery({
    queryKey: ["mesaPedido", idMesa],
    queryFn: () => getMesa({ data: { idMesa } }),
  });
  const catQ = useQuery({
    queryKey: ["catalogoServicio"],
    queryFn: () => getCat(),
  });

  const [catActiva, setCatActiva] = useState<string | null>(null);
  const [editing, setEditing] = useState<{
    id_producto: string;
    nombre_producto: string;
    precio_venta: number;
  } | null>(null);

  const productosFiltrados = useMemo(() => {
    if (!catQ.data) return [];
    if (!catActiva) return catQ.data.productos;
    return catQ.data.productos.filter((p) => p.id_categoria === catActiva);
  }, [catQ.data, catActiva]);

  const delMut = useMutation({
    mutationFn: (idItem: string) => delFn({ data: { idItem } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mesaPedido", idMesa] });
      toast.success("Item eliminado");
    },
    onError: (e) =>
      toast.error("Error", { description: e instanceof Error ? e.message : undefined }),
  });

  const confMut = useMutation({
    mutationFn: () => confFn({ data: { idPedido: mesaQ.data!.pedido!.id_pedido } }),
    onSuccess: () => {
      toast.success("¡Orden enviada a cocina/barra!", {
        icon: <CheckCircle2 className="h-4 w-4" />,
      });
      qc.invalidateQueries({ queryKey: ["mesaPedido", idMesa] });
    },
    onError: (e) =>
      toast.error("No se pudo confirmar", {
        description: e instanceof Error ? e.message : undefined,
      }),
  });

  if (mesaQ.isLoading || catQ.isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (mesaQ.isError || !mesaQ.data) {
    return (
      <p className="text-sm text-destructive">
        No se pudo cargar la mesa.{" "}
        <Link to="/servicio" className="underline">
          Volver
        </Link>
      </p>
    );
  }

  const { mesa, pedido, items, extras, exclusiones } = mesaQ.data;
  const confirmado = pedido?.estado === "CONFIRMADO";

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon">
          <Link to="/servicio">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            Mesa
          </p>
          <h1 className="text-2xl font-bold">{mesa.identificador}</h1>
        </div>
        {confirmado && (
          <span className="ml-auto rounded-full bg-primary/15 px-3 py-1 text-xs font-semibold text-primary">
            Pedido enviado
          </span>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        {/* Catálogo */}
        <div className="space-y-3">
          {(catQ.data?.categorias.length ?? 0) > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              <PillBtn
                active={catActiva === null}
                onClick={() => setCatActiva(null)}
              >
                Todo
              </PillBtn>
              {catQ.data!.categorias.map((c) => (
                <PillBtn
                  key={c.id_categoria}
                  active={catActiva === c.id_categoria}
                  onClick={() => setCatActiva(c.id_categoria)}
                >
                  {c.nombre}{" "}
                  <span className="ml-1 text-[10px] opacity-70">
                    {c.destino === "BARRA" ? "🍷" : "🍳"}
                  </span>
                </PillBtn>
              ))}
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {productosFiltrados.map((p) => (
              <button
                key={p.id_producto}
                disabled={confirmado}
                onClick={() => setEditing(p)}
                className="text-left rounded-xl border bg-card p-3 hover:shadow-md transition-shadow disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="flex gap-3">
                  <div className="h-16 w-16 shrink-0 rounded-lg bg-muted flex items-center justify-center overflow-hidden">
                    {p.url_imagen ? (
                      <img
                        src={p.url_imagen}
                        alt={p.nombre_producto}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <ImageIcon className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-sm line-clamp-1">
                      {p.nombre_producto}
                    </h3>
                    <p className="text-sm font-bold mt-1 tabular-nums">
                      {fmt.format(p.precio_venta)}
                    </p>
                  </div>
                  <Plus className="h-4 w-4 text-muted-foreground self-center" />
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Pedido */}
        <aside className="rounded-xl border bg-card p-4 space-y-3 h-fit sticky top-16">
          <h2 className="font-semibold">Orden actual</h2>
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              Aún no hay items.
            </p>
          ) : (
            <ul className="space-y-2 divide-y">
              {items.map((it) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const prod: any = it.productos;
                const ex = extras.filter((e) => e.id_item === it.id_item);
                const xc = exclusiones.filter((x) => x.id_item === it.id_item);
                return (
                  <li key={it.id_item} className="pt-2 first:pt-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          {it.tiene_alergia && (
                            <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />
                          )}
                          <span className="text-sm font-medium">
                            {Number(it.cantidad)}× {prod?.nombre_producto ?? "—"}
                          </span>
                        </div>
                        {it.tiene_alergia && (
                          <p className="text-[11px] text-destructive font-semibold mt-0.5">
                            🚨 ALERGIA
                          </p>
                        )}
                        {ex.length > 0 && (
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            +{" "}
                            {ex
                              // eslint-disable-next-line @typescript-eslint/no-explicit-any
                              .map((e) => (e.insumos as any)?.nombre_insumo)
                              .join(", ")}
                          </p>
                        )}
                        {xc.length > 0 && (
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            Sin{" "}
                            {xc
                              // eslint-disable-next-line @typescript-eslint/no-explicit-any
                              .map((x) => (x.insumos as any)?.nombre_insumo)
                              .join(", ")}
                          </p>
                        )}
                        {it.nota && (
                          <p className="text-[11px] italic text-muted-foreground mt-0.5">
                            “{it.nota}”
                          </p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-semibold tabular-nums">
                          {fmt.format(Number(it.cantidad) * Number(it.precio_unitario))}
                        </p>
                        {!confirmado && (
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-destructive"
                            onClick={() => delMut.mutate(it.id_item)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="border-t pt-3 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Total</span>
            <span className="text-xl font-bold tabular-nums">
              {fmt.format(Number(pedido?.total ?? 0))}
            </span>
          </div>

          <Button
            className="w-full h-12"
            disabled={items.length === 0 || confirmado || confMut.isPending}
            onClick={() => confMut.mutate()}
          >
            {confMut.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : confirmado ? (
              "Pedido enviado"
            ) : (
              "Confirmar orden"
            )}
          </Button>
        </aside>
      </div>

      <ItemEditorSheet
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
        producto={editing}
        idPedido={pedido?.id_pedido ?? ""}
      />
    </div>
  );
}

function PillBtn({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm border transition-colors ${
        active
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-card border-border hover:bg-muted"
      }`}
    >
      {children}
    </button>
  );
}
