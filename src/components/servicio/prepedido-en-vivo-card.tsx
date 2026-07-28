import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Loader2, Pencil, Radio, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import {
  aceptarPrepedido,
  eliminarItemPrepedidoStaff,
  type PrepedidoData,
  type PrepedidoItem,
} from "@/lib/prepedido.functions";
import { obtenerMesaSesion } from "@/lib/servicio.functions";
import { imprimirComandasDePedido } from "@/lib/comandas";
import { PrepedidoItemEditorStaff } from "./prepedido-item-editor-staff";

const fmt = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

interface Props {
  idMesa: string;
  data: PrepedidoData;
}

export function PrepedidoEnVivoCard({ idMesa, data }: Props) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<PrepedidoItem | null>(null);
  const [deleting, setDeleting] = useState<PrepedidoItem | null>(null);

  const invalidar = () => {
    qc.invalidateQueries({ queryKey: ["mesaSesion", idMesa] });
    qc.invalidateQueries({ queryKey: ["prepedidoMesa", idMesa] });
  };

  const aceptarMut = useMutation({
    mutationFn: () => aceptarPrepedido({ idMesa }),
    onSuccess: async (r) => {
      toast.success(`Pre-pedido aceptado: ${r.aceptados} items pasaron a la comanda`, {
        icon: <CheckCircle2 className="h-4 w-4" />,
      });
      invalidar();
      // Si el pedido ya estaba CONFIRMADO, la preparación arrancó en el backend y
      // nadie más va a imprimir estos items: la impresión automática solo ocurre
      // al confirmar. Sacamos la comanda aquí, con lo nuevo únicamente.
      if (r.estado_pedido !== "CONFIRMADO" || !r.id_pedido || r.id_items.length === 0) return;
      try {
        const fresh = await obtenerMesaSesion(idMesa);
        const pedido = fresh.pedidos.find((p) => p.id_pedido === r.id_pedido);
        if (!pedido) return;
        // fire-and-forget: la impresión nunca bloquea ni rompe el flujo.
        imprimirComandasDePedido(fresh.identificador, fresh.mesero_nombre, pedido, r.id_items);
      } catch {
        /* si el refetch falla, no interrumpimos el servicio */
      }
    },
    onError: (e) =>
      toast.error("No se pudo aceptar el pre-pedido", {
        description: e instanceof Error ? e.message : undefined,
      }),
  });

  const eliminarMut = useMutation({
    mutationFn: (idItem: string) => eliminarItemPrepedidoStaff({ idItem }),
    onSuccess: () => {
      toast.success("Item eliminado del pre-pedido");
      invalidar();
      setDeleting(null);
    },
    onError: (e) =>
      toast.error("No se pudo eliminar", {
        description: e instanceof Error ? e.message : undefined,
      }),
  });

  const grupos = useMemo(() => {
    const bySesion = new Map<string, typeof data.items>();
    for (const it of data.items) {
      const arr = bySesion.get(it.id_sesion) ?? [];
      arr.push(it);
      bySesion.set(it.id_sesion, arr);
    }
    return data.sesiones
      .map((s) => ({ sesion: s, items: bySesion.get(s.id_sesion) ?? [] }))
      .filter((g) => g.items.length > 0);
  }, [data]);

  if (data.items.length === 0) return null;

  const totalItems = data.items.reduce((a, i) => a + i.cantidad, 0);

  return (
    <>
      <div className="rounded-xl border-2 border-primary/40 bg-primary/5 p-4 space-y-3">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="relative inline-flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary" />
            </span>
            <h3 className="text-sm font-bold uppercase tracking-wide text-primary inline-flex items-center gap-1.5">
              <Radio className="h-3.5 w-3.5" />
              Cliente armando pedido
            </h3>
          </div>
          <span className="text-xs text-muted-foreground">
            {totalItems} items · {fmt.format(data.total)}
          </span>
        </div>

        <div className="space-y-3">
          {grupos.map(({ sesion, items }) => (
            <div key={sesion.id_sesion} className="rounded-lg bg-card p-3 border">
              <p className="text-xs font-semibold text-muted-foreground mb-2">{sesion.nombre}</p>
              <ul className="space-y-2">
                {items.map((it) => (
                  <li
                    key={it.id_prepedido_item}
                    className="text-sm flex items-start justify-between gap-2 pb-2 border-b last:border-b-0 last:pb-0"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="leading-snug">
                        <span className="tabular-nums font-medium">{it.cantidad}× </span>
                        {it.nombre_producto}
                        {it.tiene_alergia && (
                          <AlertTriangle className="inline h-3.5 w-3.5 ml-1 text-amber-600" />
                        )}
                      </p>
                      {it.variantes.length > 0 && (
                        <p className="text-xs text-muted-foreground">
                          {it.variantes
                            .map(
                              (v) =>
                                `${v.nombre_grupo}: ${v.nombre_opcion}${v.precio_delta > 0 ? ` (+${fmt.format(v.precio_delta)})` : ""}`,
                            )
                            .join(" · ")}
                        </p>
                      )}
                      {it.extras.length > 0 && (
                        <p className="text-xs text-muted-foreground">
                          + {it.extras.map((e) => e.nombre).join(", ")}
                        </p>
                      )}
                      {it.exclusiones.length > 0 && (
                        <p className="text-xs text-muted-foreground">
                          Sin: {it.exclusiones.map((x) => x.nombre).join(", ")}
                        </p>
                      )}
                      {it.nota && (
                        <p className="text-xs italic text-muted-foreground">“{it.nota}”</p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className="text-xs font-semibold tabular-nums">
                        {fmt.format(it.subtotal)}
                      </span>
                      <div className="flex gap-1">
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => setEditing(it)}
                          aria-label="Editar item"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => setDeleting(it)}
                          aria-label="Eliminar item"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <Button
          className="w-full"
          onClick={() => aceptarMut.mutate()}
          disabled={aceptarMut.isPending}
        >
          {aceptarMut.isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <CheckCircle2 className="h-4 w-4 mr-2" />
          )}
          Aceptar y aprobar todo
        </Button>
      </div>

      <PrepedidoItemEditorStaff
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
        idMesa={idMesa}
        item={editing}
      />

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este item?</AlertDialogTitle>
            <AlertDialogDescription>
              Se quitará “{deleting?.nombre_producto}” del pre-pedido. No se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={eliminarMut.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={eliminarMut.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (deleting) eliminarMut.mutate(deleting.id_prepedido_item);
              }}
            >
              {eliminarMut.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
