import { useEffect, useState } from "react";
import { AlertTriangle, Clock, StickyNote } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { ComandaEstacion } from "@/lib/preparacion.functions";
import { estadoComanda, inicioComanda, maxRetrasoMin, minutosTranscurridos } from "./comanda-utils";

interface Props {
  comanda: ComandaEstacion;
  onOpen: () => void;
}

const ESTADO_ICON: Record<string, string> = {
  EN_COLA: "⏸",
  EN_PREPARACION: "⏳",
  LISTO: "✓",
  ENTREGADO: "✓✓",
};

export function ComandaCard({ comanda, onOpen }: Props) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const estado = estadoComanda(comanda.items);
  const total = comanda.items.length;
  const listos = comanda.items.filter(
    (i) => i.estado_preparacion === "LISTO" || i.estado_preparacion === "ENTREGADO",
  ).length;
  const pct = total > 0 ? Math.round((listos / total) * 100) : 0;

  const tieneAlergia = comanda.items.some((i) => i.tiene_alergia);
  const tieneNotas = comanda.items.filter((i) => i.nota).length;
  const retraso = maxRetrasoMin(comanda.items);
  const transcurrido = Math.floor(minutosTranscurridos(inicioComanda(comanda)));

  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "w-full text-left rounded-lg border bg-card p-3 shadow-sm transition-all space-y-3",
        "hover:shadow-md hover:border-primary/40",
        retraso > 0 && "border-destructive ring-1 ring-destructive/40",
        tieneAlergia && "ring-2 ring-red-500",
      )}
    >
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Mesa</p>
          <h3 className="text-lg font-bold leading-tight truncate">
            {comanda.mesa_identificador}
          </h3>
        </div>
        <Badge variant="outline" className="shrink-0 text-xs tabular-nums">
          <Clock className="h-3 w-3 mr-1" />
          {transcurrido}min
        </Badge>
      </header>

      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium">
            {listos} / {total} listos
          </span>
          <span className="text-muted-foreground">{pct}%</span>
        </div>
        <Progress value={pct} className="h-2" />
      </div>

      <ul className="space-y-1">
        {comanda.items.slice(0, 4).map((it) => (
          <li
            key={it.id_item}
            className="flex items-center gap-2 text-xs"
          >
            <span className="w-4 text-center">{ESTADO_ICON[it.estado_preparacion] ?? "·"}</span>
            {it.cantidad > 1 && <span className="font-medium tabular-nums">×{it.cantidad}</span>}
            <span className="flex-1 truncate">{it.nombre_producto}</span>
            {it.tiene_alergia && (
              <AlertTriangle className="h-3 w-3 text-red-600 shrink-0" />
            )}
          </li>
        ))}
        {comanda.items.length > 4 && (
          <li className="text-[11px] text-muted-foreground pl-6">
            + {comanda.items.length - 4} más
          </li>
        )}
      </ul>

      <footer className="flex items-center justify-between gap-2 pt-1 border-t">
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground flex-wrap">
          {tieneAlergia && (
            <span className="flex items-center gap-0.5 font-semibold text-red-600">
              <AlertTriangle className="h-3 w-3" /> Alergia
            </span>
          )}
          {tieneNotas > 0 && (
            <span className="flex items-center gap-0.5">
              <StickyNote className="h-3 w-3" /> {tieneNotas}
            </span>
          )}
          {retraso > 0 && (
            <Badge variant="destructive" className="text-[10px] h-4 px-1">
              +{retraso}min
            </Badge>
          )}
        </div>
        <span className="text-[11px] font-medium text-primary">Ver comanda →</span>
      </footer>

      {/* estado es informativo (la columna ya lo refleja) */}
      <span className="sr-only">{estado}</span>
    </button>
  );
}
