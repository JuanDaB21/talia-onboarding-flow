import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Banknote, CreditCard, Smartphone, Clock } from "lucide-react";
import { resumenCajaTurno } from "@/lib/pagos.functions";

const fmt = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

export function CajaTurnoCard() {
  const r = useServerFn(resumenCajaTurno);
  const q = useQuery({
    queryKey: ["caja", "turno"],
    queryFn: () => r(),
    refetchInterval: 30_000,
  });
  const d = q.data;
  if (!d) return null;
  return (
    <section className="rounded-xl border bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Mi caja de hoy
        </h2>
        <span className="text-lg font-bold tabular-nums">{fmt.format(d.total)}</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Stat icon={<Banknote className="h-4 w-4" />} label="Efectivo" v={d.efectivo} />
        <Stat icon={<CreditCard className="h-4 w-4" />} label="Datáfono" v={d.datafono} />
        <Stat
          icon={<Smartphone className="h-4 w-4" />}
          label="Transfer. OK"
          v={d.transferencia_confirmada}
        />
        <Stat
          icon={<Clock className="h-4 w-4" />}
          label="Transfer. pend."
          v={d.transferencia_pendiente}
          muted
        />
      </div>
    </section>
  );
}

function Stat({
  icon,
  label,
  v,
  muted,
}: {
  icon: React.ReactNode;
  label: string;
  v: number;
  muted?: boolean;
}) {
  return (
    <div className={`rounded-lg border p-2 ${muted ? "bg-muted/40" : "bg-card"}`}>
      <div className="flex items-center gap-1 text-[11px] text-muted-foreground uppercase tracking-wider">
        {icon}
        {label}
      </div>
      <p className="mt-1 font-bold tabular-nums text-sm">{fmt.format(v)}</p>
    </div>
  );
}
