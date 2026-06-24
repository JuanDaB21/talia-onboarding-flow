import { Card, CardContent } from "@/components/ui/card";
import { CalendarCheck, Wallet, Undo2, Lock } from "lucide-react";

const fmt = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

interface Props {
  total: number;
  abonado: number;
  devuelto: number;
  retenido: number;
}

export function ReservasMetricasCards({ total, abonado, devuelto, retenido }: Props) {
  const items = [
    {
      label: "Reservas hoy",
      value: String(total),
      icon: CalendarCheck,
      color: "text-primary",
    },
    {
      label: "Abonado hoy",
      value: fmt.format(abonado),
      icon: Wallet,
      color: "text-emerald-600",
    },
    {
      label: "Devuelto hoy",
      value: fmt.format(devuelto),
      icon: Undo2,
      color: "text-amber-600",
    },
    {
      label: "Retenido (penalidad)",
      value: fmt.format(retenido),
      icon: Lock,
      color: "text-rose-600",
    },
  ];
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {items.map((it) => {
        const Icon = it.icon;
        return (
          <Card key={it.label}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs uppercase tracking-wider text-muted-foreground">
                  {it.label}
                </span>
                <Icon className={`h-4 w-4 ${it.color}`} />
              </div>
              <p className="text-2xl font-bold tabular-nums">{it.value}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
