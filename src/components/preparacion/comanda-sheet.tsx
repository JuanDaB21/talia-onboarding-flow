import { useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  MinusCircle,
  PlusCircle,
  PlayCircle,
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
import { minutosTranscurridos, retrasoItem } from "./comanda-utils";

interface Props {
  comanda: ComandaEstacion | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdvance: (idItem: string, nuevo: "EN_PREPARACION" | "LISTO") => Promise<void>;
  onIniciarTodo: () => Promise<void>;
  busyId: string | null;
  iniciandoTodo: boolean;
}

const ESTADO_BADGE: Record<string, { label: string; cls: string }> = {
  EN_COLA: { label: "En cola", cls: "bg-muted text-muted-foreground" },
  EN_PREPARACION: { label: "En preparación", cls: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
  LISTO: { label: "Listo", cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
  ENTREGADO: { label: "Entregado", cls: "bg-primary/15 text-primary" },
};

function siguienteEstado(
  e: string,
): "EN_PREPARACION" | "LISTO" | null {
  if (e === "EN_COLA") return "EN_PREPARACION";
  if (e === "EN_PREPARACION") return "LISTO";
  return null;
}

function labelAccion(s: "EN_PREPARACION" | "LISTO" | null) {
  if (s === "EN_PREPARACION") return "Iniciar";
  if (s === "LISTO") return "Marcar listo";
  return "";
}

export function ComandaSheet({
  comanda,
  open,
  onOpenChange,
  onAdvance,
  onIniciarTodo,
  busyId,
  iniciandoTodo,
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
  const hayEnCola = comanda.items.some((i) => i.estado_preparacion === "EN_COLA");
  const transcurrido = Math.floor(minutosTranscurridos(comanda.pedido_created_at));

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
          {hayEnCola && (
            <Button
              onClick={onIniciarTodo}
              disabled={iniciandoTodo}
              variant="secondary"
              className="mt-3 w-full"
              size="sm"
            >
              <PlayCircle className="h-4 w-4 mr-2" />
              Iniciar toda la comanda
            </Button>
          )}
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {comanda.items.map((it) => (
            <ItemRow
              key={it.id_item}
              item={it}
              onAdvance={onAdvance}
              busy={busyId === it.id_item}
            />
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}

interface ItemRowProps {
  item: ItemPreparacion;
  onAdvance: (idItem: string, nuevo: "EN_PREPARACION" | "LISTO") => Promise<void>;
  busy: boolean;
}

function ItemRow({ item, onAdvance, busy }: ItemRowProps) {
  const sig = siguienteEstado(item.estado_preparacion);
  const estado = ESTADO_BADGE[item.estado_preparacion];
  const retraso = retrasoItem(item);
  const planeado = item.tiempo_planeado_min ?? 0;

  let tiempoTexto = "";
  if (item.estado_preparacion === "EN_PREPARACION") {
    const t = Math.floor(minutosTranscurridos(item.iniciado_at));
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
                <span className="tabular-nums">×{item.cantidad}</span>{" "}
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
              <Button
                size="sm"
                variant={sig === "LISTO" ? "default" : "outline"}
                disabled={busy}
                onClick={() => onAdvance(item.id_item, sig)}
              >
                {labelAccion(sig)}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
