import { useEffect, useState } from "react";
import { AlertTriangle, Clock, MinusCircle, PlusCircle, StickyNote } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ItemPreparacion } from "@/lib/preparacion.functions";

interface Props {
  item: ItemPreparacion;
  onAdvance: (nuevoEstado: "EN_PREPARACION" | "LISTO" | "ENTREGADO") => void;
  busy?: boolean;
}

function diffMin(from: string | null): number {
  if (!from) return 0;
  return (Date.now() - new Date(from).getTime()) / 60000;
}

export function ItemCard({ item, onAdvance, busy }: Props) {
  // Tick para refrescar contadores
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const planeado = item.tiempo_planeado_min ?? 0;
  let transcurrido = 0;
  let estadoRef: string | null = null;
  if (item.estado_preparacion === "EN_PREPARACION") {
    transcurrido = diffMin(item.iniciado_at);
    estadoRef = "prep";
  } else if (item.estado_preparacion === "EN_COLA") {
    transcurrido = diffMin(item.pedido_created_at);
    estadoRef = "cola";
  } else if (item.estado_preparacion === "LISTO") {
    transcurrido = diffMin(item.listo_at);
    estadoRef = "listo";
  }

  const retrasoMin = Math.max(0, Math.floor(transcurrido - planeado));
  const retrasado = estadoRef === "prep" && planeado > 0 && transcurrido > planeado;
  const colaTarde = estadoRef === "cola" && planeado > 0 && transcurrido > planeado;

  const sigEstado: "EN_PREPARACION" | "LISTO" | "ENTREGADO" | null =
    item.estado_preparacion === "EN_COLA"
      ? "EN_PREPARACION"
      : item.estado_preparacion === "EN_PREPARACION"
        ? "LISTO"
        : item.estado_preparacion === "LISTO"
          ? "ENTREGADO"
          : null;

  const sigLabel =
    sigEstado === "EN_PREPARACION"
      ? "Iniciar"
      : sigEstado === "LISTO"
        ? "Marcar listo"
        : sigEstado === "ENTREGADO"
          ? "Entregado"
          : "";

  return (
    <div
      className={cn(
        "rounded-md border bg-card p-3 shadow-sm transition-colors space-y-2",
        retrasado && "border-destructive ring-1 ring-destructive/40",
        item.tiene_alergia && "ring-2 ring-red-500",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-base font-semibold">×{item.cantidad}</span>
            <span className="text-sm font-medium truncate">{item.nombre_producto}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">Mesa {item.mesa_identificador}</p>
        </div>
        <Badge variant="outline" className="shrink-0 text-xs">
          <Clock className="h-3 w-3 mr-1" />
          {planeado || "—"}min
        </Badge>
      </div>

      {item.tiene_alergia && (
        <div className="flex items-center gap-1.5 text-xs font-semibold text-red-600 bg-red-50 dark:bg-red-950/30 rounded px-2 py-1">
          <AlertTriangle className="h-3.5 w-3.5" />
          ¡ALERGIA! Tomar precauciones
        </div>
      )}

      {item.extras.length > 0 && (
        <div className="space-y-0.5">
          {item.extras.map((e, idx) => (
            <div key={idx} className="flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-400">
              <PlusCircle className="h-3 w-3" />
              <span>
                {e.nombre} <span className="text-muted-foreground">({e.cantidad})</span>
              </span>
            </div>
          ))}
        </div>
      )}

      {item.exclusiones.length > 0 && (
        <div className="space-y-0.5">
          {item.exclusiones.map((e, idx) => (
            <div key={idx} className="flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400">
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

      <div className="flex items-center justify-between gap-2 pt-1">
        <div className="text-xs">
          {retrasado && (
            <Badge variant="destructive" className="text-[10px]">
              Retraso +{retrasoMin}min
            </Badge>
          )}
          {colaTarde && !retrasado && (
            <Badge className="text-[10px] bg-amber-500 hover:bg-amber-500/90 text-white">
              Sin tomar +{retrasoMin}min
            </Badge>
          )}
          {!retrasado && !colaTarde && estadoRef && (
            <span className="text-muted-foreground tabular-nums">
              {Math.floor(transcurrido)}min
            </span>
          )}
        </div>
        {sigEstado && (
          <Button size="sm" disabled={busy} onClick={() => onAdvance(sigEstado)}>
            {sigLabel}
          </Button>
        )}
      </div>
    </div>
  );
}
