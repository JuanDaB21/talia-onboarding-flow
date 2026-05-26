import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Clock, LogIn } from "lucide-react";
import { getMiStaff } from "@/lib/turno.functions";

function formatDuracion(ms: number) {
  if (ms < 0) ms = 0;
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m} min`;
  return `${h}h ${m.toString().padStart(2, "0")}m`;
}

export function CajaTurnoCard() {
  const fn = useServerFn(getMiStaff);
  const { data } = useQuery({
    queryKey: ["mi-staff", "turno-card"],
    queryFn: () => fn(),
    refetchInterval: 60_000,
  });

  // tick cada minuto para refrescar el cronómetro en vivo
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  if (!data || !data.esta_en_turno || !data.turno_iniciado_at) return null;

  const inicio = new Date(data.turno_iniciado_at);
  const ahora = Date.now();
  const trabajado = ahora - inicio.getTime();
  const horaIngreso = inicio.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <section className="rounded-xl border bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Mi turno
        </h2>
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          En turno
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Stat
          icon={<LogIn className="h-4 w-4" />}
          label="Hora de ingreso"
          value={horaIngreso}
        />
        <Stat
          icon={<Clock className="h-4 w-4" />}
          label="Tiempo trabajado"
          value={formatDuracion(trabajado)}
        />
      </div>
    </section>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border p-2">
      <div className="flex items-center gap-1 text-[11px] text-muted-foreground uppercase tracking-wider">
        {icon}
        {label}
      </div>
      <p className="mt-1 font-bold tabular-nums text-sm">{value}</p>
    </div>
  );
}
