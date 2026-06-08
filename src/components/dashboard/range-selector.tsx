"use client";

import * as React from "react";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useIsMobile } from "@/hooks/use-mobile";

export type RangoPreset = "hoy" | "7d" | "30d" | "custom";

export interface DateRangeValue {
  rango: RangoPreset;
  desde?: string;
  hasta?: string;
}

function presetLabel(r: RangoPreset): string {
  switch (r) {
    case "hoy":
      return "Hoy";
    case "7d":
      return "7 días";
    case "30d":
      return "30 días";
    case "custom":
      return "Personalizado";
  }
}

export function presetToDates(rango: RangoPreset): { desde: Date; hasta: Date } {
  const hasta = new Date();
  const desde = new Date();
  if (rango === "hoy") {
    desde.setHours(0, 0, 0, 0);
  } else if (rango === "7d") {
    desde.setDate(desde.getDate() - 7);
    desde.setHours(0, 0, 0, 0);
  } else if (rango === "30d") {
    desde.setDate(desde.getDate() - 30);
    desde.setHours(0, 0, 0, 0);
  }
  return { desde, hasta };
}

export function RangeSelector({
  value,
  onChange,
}: {
  value: DateRangeValue;
  onChange: (v: DateRangeValue) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const isMobile = useIsMobile();
  const [range, setRange] = React.useState<{ from?: Date; to?: Date }>({
    from: value.desde ? new Date(value.desde) : undefined,
    to: value.hasta ? new Date(value.hasta) : undefined,
  });

  const applyCustom = () => {
    if (range.from && range.to) {
      onChange({
        rango: "custom",
        desde: range.from.toISOString(),
        hasta: range.to.toISOString(),
      });
      setOpen(false);
    }
  };

  const selectPreset = (r: RangoPreset) => {
    if (r === "custom") {
      setOpen(true);
      return;
    }
    const { desde, hasta } = presetToDates(r);
    onChange({
      rango: r,
      desde: desde.toISOString(),
      hasta: hasta.toISOString(),
    });
  };

  const presets: RangoPreset[] = ["hoy", "7d", "30d", "custom"];

  const displayText =
    value.rango === "custom" && value.desde && value.hasta
      ? `${format(new Date(value.desde), "dd/MM/yyyy")} – ${format(new Date(value.hasta), "dd/MM/yyyy")}`
      : presetLabel(value.rango);

  return (
    <div className="inline-flex flex-wrap rounded-md border bg-card p-1">
      {presets.map((p) =>
        p === "custom" ? (
          <Popover key={p} open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button
                size="sm"
                variant={value.rango === "custom" ? "default" : "ghost"}
                className={cn(
                  "h-7 px-3 text-xs",
                  value.rango === "custom" && "shadow-sm"
                )}
              >
                <CalendarIcon className="mr-1 h-3 w-3" />
                {value.rango === "custom" ? displayText : "Personalizado"}
              </Button>
            </PopoverTrigger>
            <PopoverContent
              className="w-auto max-w-[95vw] p-0"
              align={isMobile ? "center" : "end"}
              side="bottom"
              sideOffset={8}
              collisionPadding={12}
            >
              <div className="p-3 pointer-events-auto">
                <Calendar
                  mode="range"
                  selected={{
                    from: range.from,
                    to: range.to,
                  }}
                  onSelect={(selected) => {
                    setRange({ from: selected?.from, to: selected?.to });
                  }}
                  numberOfMonths={isMobile ? 1 : 2}
                  className="[&_button]:h-10 [&_button]:w-10 sm:[&_button]:h-9 sm:[&_button]:w-9"
                />
                <div className="flex justify-end gap-2 p-3 pt-0">
                  <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
                    Cancelar
                  </Button>
                  <Button size="sm" onClick={applyCustom} disabled={!range.from || !range.to}>
                    Aplicar
                  </Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        ) : (
          <Button
            key={p}
            size="sm"
            variant={value.rango === p ? "default" : "ghost"}
            className={cn("h-7 px-3 text-xs", value.rango === p && "shadow-sm")}
            onClick={() => selectPreset(p)}
          >
            {presetLabel(p)}
          </Button>
        )
      )}
    </div>
  );
}
