import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type Rango = "hoy" | "7d" | "30d";

const opts: { v: Rango; label: string }[] = [
  { v: "hoy", label: "Hoy" },
  { v: "7d", label: "7 días" },
  { v: "30d", label: "30 días" },
];

export function RangeSelector({ value, onChange }: { value: Rango; onChange: (r: Rango) => void }) {
  return (
    <div className="inline-flex rounded-md border bg-card p-1">
      {opts.map((o) => (
        <Button
          key={o.v}
          size="sm"
          variant={value === o.v ? "default" : "ghost"}
          className={cn("h-7 px-3 text-xs", value === o.v && "shadow-sm")}
          onClick={() => onChange(o.v)}
        >
          {o.label}
        </Button>
      ))}
    </div>
  );
}
