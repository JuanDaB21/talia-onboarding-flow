import { useMemo } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Loader2, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import { aceptarPrepedido, type PrepedidoData } from "@/lib/prepedido.functions";

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
  const aceptarFn = useServerFn(aceptarPrepedido);
  const aceptarMut = useMutation({
    mutationFn: () => aceptarFn({ data: { idMesa } }),
    onSuccess: (r) => {
      toast.success(`Pre-pedido aceptado: ${r.aceptados} items pasaron a la comanda`, {
        icon: <CheckCircle2 className="h-4 w-4" />,
      });
      qc.invalidateQueries({ queryKey: ["mesaSesion", idMesa] });
      qc.invalidateQueries({ queryKey: ["prepedidoMesa", idMesa] });
    },
    onError: (e) =>
      toast.error("No se pudo aceptar el pre-pedido", {
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
            <p className="text-xs font-semibold text-muted-foreground mb-2">
              {sesion.nombre}
            </p>
            <ul className="space-y-1.5">
              {items.map((it) => (
                <li key={it.id_prepedido_item} className="text-sm flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="leading-snug">
                      <span className="tabular-nums font-medium">{it.cantidad}× </span>
                      {it.nombre_producto}
                      {it.tiene_alergia && (
                        <AlertTriangle className="inline h-3.5 w-3.5 ml-1 text-amber-600" />
                      )}
                    </p>
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
                      <p className="text-xs italic text-muted-foreground">
                        “{it.nota}”
                      </p>
                    )}
                  </div>
                  <span className="text-xs font-semibold tabular-nums shrink-0">
                    {fmt.format(it.subtotal)}
                  </span>
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
        Aceptar y enviar a la comanda
      </Button>
    </div>
  );
}
