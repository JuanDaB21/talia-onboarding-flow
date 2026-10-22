import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { MesaServicio } from "@/lib/servicio.functions";

/**
 * Grilla de mesas para elegir un destino. Ninguna viene marcada: quien opera tiene que elegir la
 * mesa a propósito (trasladar una cuenta o sentar una reserva en la mesa equivocada cuesta caro).
 */
export function SelectorMesa({
  mesas,
  valor,
  onChange,
  cargando,
  disabled,
  vacio,
  detalle,
}: {
  mesas: MesaServicio[];
  valor: string | null;
  onChange: (idMesa: string) => void;
  cargando?: boolean;
  disabled?: boolean;
  /** Texto cuando no hay mesas para elegir. */
  vacio: string;
  /** Segunda línea opcional bajo el identificador (p. ej. "Libre" o el mesero). */
  detalle?: (m: MesaServicio) => string | null;
}) {
  if (cargando) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (mesas.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">{vacio}</p>;
  }
  return (
    <div className="grid max-h-72 grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4">
      {mesas.map((m) => {
        const sub = detalle?.(m);
        return (
          <Button
            key={m.id_mesa}
            type="button"
            variant="outline"
            aria-pressed={valor === m.id_mesa}
            disabled={disabled}
            onClick={() => onChange(m.id_mesa)}
            className={cn(
              "h-14 flex-col gap-0 text-base font-semibold",
              valor === m.id_mesa && "border-primary bg-primary/10 text-primary",
            )}
          >
            {m.identificador}
            {sub && (
              <span className="max-w-full truncate text-[10px] font-normal text-muted-foreground">
                {sub}
              </span>
            )}
          </Button>
        );
      })}
    </div>
  );
}
