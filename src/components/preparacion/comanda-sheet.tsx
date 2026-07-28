import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  MinusCircle,
  PlusCircle,
  Printer,
  StickyNote,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import type { ComandaEstacion, ItemPreparacion } from "@/lib/preparacion.functions";
import { inicioComanda, minutosTranscurridos, retrasoItem } from "./comanda-utils";
import { type ComandaDestino } from "./comanda-print";
import { enqueueComandas } from "@/lib/impresion.functions";

interface Props {
  comanda: ComandaEstacion | null;
  destino: ComandaDestino;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdvance: (idItem: string, nuevo: "LISTO") => Promise<void>;
  busyId: string | null;
}

const ESTADO_BADGE: Record<string, { label: string; cls: string }> = {
  EN_COLA: { label: "En cola", cls: "bg-muted text-muted-foreground" },
  EN_PREPARACION: { label: "En preparación", cls: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
  LISTO: { label: "Listo", cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
  ENTREGADO: { label: "Entregado", cls: "bg-primary/15 text-primary" },
};

// La estación solo cierra items: la preparación ya arrancó al confirmar el pedido.
// EN_COLA solo aparece en items anteriores a ese cambio y también pasa a LISTO.
function siguienteEstado(e: string): "LISTO" | null {
  return e === "EN_COLA" || e === "EN_PREPARACION" ? "LISTO" : null;
}

export function ComandaSheet({
  comanda,
  destino,
  open,
  onOpenChange,
  onAdvance,
  busyId,
}: Props) {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!open) return;
    const id = setInterval(() => setTick((t) => t + 1), 15_000);
    return () => clearInterval(id);
  }, [open]);

  if (!comanda) return null;

  const total = comanda.items.length;
  const listos = comanda.items.filter(
    (i) => i.estado_preparacion === "LISTO" || i.estado_preparacion === "ENTREGADO",
  ).length;
  const pct = total > 0 ? Math.round((listos / total) * 100) : 0;
  const transcurrido = Math.floor(minutosTranscurridos(inicioComanda(comanda)));

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg flex flex-col gap-0 p-0">
        <SheetHeader className="p-6 pb-4 border-b">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                Comanda · Mesa
              </p>
              <SheetTitle className="text-2xl">
                {comanda.mesa_identificador}
              </SheetTitle>
            </div>
            <Badge variant="outline" className="tabular-nums">
              <Clock className="h-3 w-3 mr-1" />
              {transcurrido}min
            </Badge>
          </div>
          <SheetDescription className="sr-only">
            Detalle interactivo de la comanda para esta mesa
          </SheetDescription>
          <div className="space-y-1 mt-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">
                {listos} / {total} listos
              </span>
              <span className="text-muted-foreground">{pct}%</span>
            </div>
            <Progress value={pct} className="h-2" />
          </div>
          <div className="mt-3 flex flex-col sm:flex-row gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() =>
                void enqueueComandas([
                  {
                    destino,
                    mesa_identificador: comanda.mesa_identificador,
                    pedido_id: comanda.id_pedido,
                    pedido_created_at: inicioComanda(comanda),
                    mesero: comanda.mesero_nombre,
                    items: comanda.items.map((it) => ({
                      cantidad: it.cantidad,
                      nombre_producto: it.nombre_producto,
                      nombre_subcategoria: it.nombre_subcategoria,
                      tiene_alergia: it.tiene_alergia,
                      nota: it.nota,
                      extras: it.extras,
                      exclusiones: it.exclusiones,
                      variantes: it.variantes,
                    })),
                  },
                ])
                  .then((r) =>
                    toast[r.agenteConectado ? "success" : "warning"](
                      r.agenteConectado
                        ? "Comanda enviada a imprimir"
                        : "Sin agente conectado: quedó en cola",
                    ),
                  )
                  .catch((e) =>
                    toast.error("No se pudo enviar a imprimir", {
                      description: e instanceof Error ? e.message : undefined,
                    }),
                  )
              }
            >
              <Printer className="h-4 w-4 mr-2" />
              Imprimir comanda
            </Button>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {(() => {
            const nodes: ReactNode[] = [];
            let currentSub: string | null | undefined = undefined;
            comanda.items.forEach((it) => {
              const sub = it.nombre_subcategoria ?? null;
              if (sub !== currentSub) {
                nodes.push(
                  <div
                    key={`sub-${sub ?? "otros"}-${it.id_item}`}
                    className="pt-1 pb-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-b"
                  >
                    {sub ?? "Otros"}
                  </div>,
                );
                currentSub = sub;
              }
              nodes.push(
                <ItemRow
                  key={it.id_item}
                  item={it}
                  onAdvance={onAdvance}
                  busy={busyId === it.id_item}
                />,
              );
            });
            return nodes;
          })()}
        </div>
      </SheetContent>
    </Sheet>
  );
}

interface ItemRowProps {
  item: ItemPreparacion;
  onAdvance: (idItem: string, nuevo: "LISTO") => Promise<void>;
  busy: boolean;
}

function ItemRow({ item, onAdvance, busy }: ItemRowProps) {
  const sig = siguienteEstado(item.estado_preparacion);
  const estado = ESTADO_BADGE[item.estado_preparacion];
  const retraso = retrasoItem(item);
  const planeado = item.tiempo_planeado_min ?? 0;

  let tiempoTexto = "";
  if (item.estado_preparacion === "EN_PREPARACION" || item.estado_preparacion === "EN_COLA") {
    const t = Math.floor(minutosTranscurridos(item.iniciado_at ?? inicioComanda(item)));
    tiempoTexto = `${t}/${planeado || "—"} min`;
  } else if (item.estado_preparacion === "LISTO" && item.listo_at) {
    const t = Math.floor(minutosTranscurridos(item.listo_at));
    tiempoTexto = `listo hace ${t} min`;
  } else if (item.estado_preparacion === "ENTREGADO" && item.entregado_at) {
    const t = Math.floor(minutosTranscurridos(item.entregado_at));
    tiempoTexto = `entregado hace ${t} min`;
  } else if (planeado > 0) {
    tiempoTexto = `~${planeado} min`;
  }

  const listoYa =
    item.estado_preparacion === "LISTO" || item.estado_preparacion === "ENTREGADO";

  return (
    <div
      className={cn(
        "rounded-md border bg-card p-3 space-y-2",
        retraso > 0 && "border-destructive",
        item.tiene_alergia && "ring-2 ring-red-500",
        listoYa && "bg-muted/40",
      )}
    >
      <div className="flex items-start gap-3">
        <button
          type="button"
          disabled={!sig || busy}
          onClick={() => sig && onAdvance(item.id_item, sig)}
          className={cn(
            "mt-0.5 h-6 w-6 rounded-full border-2 flex items-center justify-center transition-colors shrink-0",
            listoYa
              ? "bg-emerald-500 border-emerald-500 text-white"
              : "border-muted-foreground/40 hover:border-primary",
            busy && "opacity-50",
          )}
          aria-label="Avanzar item"
        >
          {listoYa && <CheckCircle2 className="h-4 w-4" />}
        </button>

        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className={cn("font-semibold", listoYa && "line-through text-muted-foreground")}>
                {item.cantidad > 1 && <span className="tabular-nums">×{item.cantidad}</span>}{" "}
                {item.nombre_producto}
              </p>
            </div>
            <Badge className={cn("text-[10px] shrink-0", estado.cls)} variant="secondary">
              {estado.label}
            </Badge>
          </div>

          {item.tiene_alergia && (
            <div className="flex items-center gap-1.5 text-xs font-semibold text-red-600 bg-red-50 dark:bg-red-950/30 rounded px-2 py-1">
              <AlertTriangle className="h-3.5 w-3.5" />
              ¡ALERGIA! Tomar precauciones
            </div>
          )}

          {item.variantes.length > 0 && (
            <div className="space-y-0.5">
              {item.variantes.map((v, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-1 text-xs text-blue-700 dark:text-blue-400"
                >
                  <span>▸ {v.nombre_grupo}: <strong>{v.nombre_opcion}</strong></span>
                </div>
              ))}
            </div>
          )}

          {item.extras.length > 0 && (
            <div className="space-y-0.5">
              {item.extras.map((e, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-400"
                >
                  <PlusCircle className="h-3 w-3" />
                  <span>
                    {e.nombre}{" "}
                    <span className="text-muted-foreground">({e.cantidad})</span>
                  </span>
                </div>
              ))}
            </div>
          )}

          {item.exclusiones.length > 0 && (
            <div className="space-y-0.5">
              {item.exclusiones.map((e, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400"
                >
                  <MinusCircle className="h-3 w-3" />
                  <span>Sin {e.nombre}</span>
                </div>
              ))}
            </div>
          )}

          {item.nota && (
            <div className="flex items-start gap-1.5 text-xs text-muted-foreground bg-muted/40 rounded px-2 py-1">
              <StickyNote className="h-3 w-3 mt-0.5 shrink-0" />
              <span className="break-words">{item.nota}</span>
            </div>
          )}

          <div className="flex items-center justify-between pt-1 gap-2">
            <span
              className={cn(
                "text-xs tabular-nums",
                retraso > 0 ? "text-destructive font-medium" : "text-muted-foreground",
              )}
            >
              {tiempoTexto}
              {retraso > 0 && ` · retraso +${retraso}`}
            </span>
            {sig && (
              <Button size="sm" disabled={busy} onClick={() => onAdvance(item.id_item, sig)}>
                Marcar listo
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
