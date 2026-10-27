import { memo } from "react";
import { Bike, CheckCircle2, Clock, Loader2, MapPin, Paperclip, ShoppingBag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/format";
import type { Domicilio } from "@/lib/domicilios.functions";
import { estadoCobro, METODO_LABEL, minutosDesde } from "./domicilio-utils";

export interface AccionRapida {
  label: string;
  onClick: () => void;
  pending?: boolean;
}

function DomicilioCardBase({
  d,
  ahora,
  onOpen,
  accion,
}: {
  d: Domicilio;
  ahora: number;
  onOpen: () => void;
  accion: AccionRapida | null;
}) {
  const min = minutosDesde(d.created_at, ahora);
  const listos = d.items.filter(
    (i) => i.estado_preparacion === "LISTO" || i.estado_preparacion === "ENTREGADO",
  ).length;
  const cobro = estadoCobro(d);
  const urgente = d.estado === "PENDIENTE" && min >= 5;

  return (
    <article
      className={cn(
        "rounded-xl border bg-card p-3 shadow-sm transition-shadow hover:shadow-md",
        urgente && "border-amber-500/70 ring-1 ring-amber-500/30",
      )}
    >
      <button type="button" onClick={onOpen} className="block w-full text-left">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 font-mono text-sm font-bold">
            {d.tipo === "DOMICILIO" ? (
              <Bike className="h-4 w-4 text-primary" />
            ) : (
              <ShoppingBag className="h-4 w-4 text-primary" />
            )}
            {d.codigo}
          </span>
          <span
            className={cn(
              "flex items-center gap-1 text-xs tabular-nums text-muted-foreground",
              urgente && "font-semibold text-amber-600",
            )}
          >
            <Clock className="h-3 w-3" /> {min} min
          </span>
        </div>
        <p className="mt-1.5 truncate text-sm font-medium">{d.cliente_nombre}</p>
        {d.tipo === "DOMICILIO" ? (
          <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
            <MapPin className="h-3 w-3 shrink-0" />
            {d.municipio_nombre ? `${d.municipio_nombre} · ` : ""}
            {d.direccion}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">Para recoger</p>
        )}

        {d.estado === "EN_PREPARACION" && d.items.length > 0 && (
          <div className="mt-2">
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${Math.round((listos / d.items.length) * 100)}%` }}
              />
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {listos}/{d.items.length} listos en cocina
            </p>
          </div>
        )}

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="text-sm font-semibold tabular-nums">{formatMoney(d.total)}</span>
          <Badge variant="secondary" className="text-[10px] font-medium">
            {METODO_LABEL[d.metodo_pago]}
          </Badge>
          {cobro === "pagado" && (
            <Badge className="gap-1 bg-emerald-600 text-[10px] hover:bg-emerald-600">
              <CheckCircle2 className="h-3 w-3" /> Pagado
            </Badge>
          )}
          {cobro === "por-verificar" && (
            <Badge variant="outline" className="border-amber-500 text-[10px] text-amber-700">
              Por verificar
            </Badge>
          )}
          {cobro === "comprobante" && (
            <Badge variant="outline" className="gap-1 text-[10px]">
              <Paperclip className="h-3 w-3" /> Comprobante
            </Badge>
          )}
        </div>
      </button>

      {accion && (
        <Button
          size="sm"
          className="mt-3 h-8 w-full"
          onClick={accion.onClick}
          disabled={accion.pending}
        >
          {accion.pending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
          {accion.label}
        </Button>
      )}
    </article>
  );
}

export const DomicilioCard = memo(DomicilioCardBase);
