import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Plus, Search, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getMetricasReservasHoy,
  listarReservas,
  type Reserva,
} from "@/lib/reservas.functions";
import { ESTADOS_RESERVA, ESTADO_LABEL } from "@/lib/reservas.schemas";
import { fechaLocalISO } from "@/lib/format";
import { ReservasMetricasCards } from "@/components/reservas/reservas-metricas-cards";
import { ReservaCard } from "@/components/reservas/reserva-card";
import { ReservaFormSheet } from "@/components/reservas/reserva-form-sheet";

export const Route = createFileRoute("/_app/reservas/")({
  component: ReservasPage,
});

// Fecha LOCAL: con `toISOString()` la lista abría en el día equivocado a partir
// de las 7pm en Colombia (UTC−5), justo en horario de cena.
const today = () => fechaLocalISO();

function ReservasPage() {
  const [fecha, setFecha] = useState<string>(today());
  const [estado, setEstado] = useState<string>("");
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Reserva | null>(null);

  const reservasQ = useQuery({
    queryKey: ["reservas", { fecha, estado, search }],
    queryFn: () =>
      listarReservas({
        fecha: fecha || undefined,
        estado: estado || undefined,
        search: search || undefined,
      }),
  });

  const metricasQ = useQuery({
    queryKey: ["reservas", "metricas-hoy"],
    queryFn: () => getMetricasReservasHoy(),
  });

  const grupos = useMemo(() => {
    const m = new Map<string, Reserva[]>();
    for (const r of reservasQ.data ?? []) {
      const arr = m.get(r.hora_reserva) ?? [];
      arr.push(r);
      m.set(r.hora_reserva, arr);
    }
    return Array.from(m.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [reservasQ.data]);

  const openNueva = () => {
    setEditing(null);
    setFormOpen(true);
  };
  const openEdit = (r: Reserva) => {
    setEditing(r);
    setFormOpen(true);
  };

  return (
    <div className="p-4 lg:p-6 space-y-5 max-w-6xl mx-auto w-full">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Reservas</h1>
          <p className="text-sm text-muted-foreground">
            Agenda diaria, abonos y aplicación en checkout
          </p>
        </div>
        <Button onClick={openNueva}>
          <Plus className="h-4 w-4 mr-1" />
          Nueva reserva
        </Button>
      </div>

      <ReservasMetricasCards
        total={metricasQ.data?.total ?? 0}
        abonado={metricasQ.data?.abonado ?? 0}
        devuelto={metricasQ.data?.devuelto ?? 0}
        retenido={metricasQ.data?.retenido ?? 0}
      />

      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por código o nombre..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="relative">
          <CalendarDays className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className="pl-9 w-[170px]"
          />
        </div>
        <Select value={estado || "all"} onValueChange={(v) => setEstado(v === "all" ? "" : v)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Todos los estados" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            {ESTADOS_RESERVA.map((s) => (
              <SelectItem key={s} value={s}>
                {ESTADO_LABEL[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {fecha !== today() && (
          <Button variant="ghost" size="sm" onClick={() => setFecha(today())}>
            Hoy
          </Button>
        )}
      </div>

      <div className="space-y-5">
        {reservasQ.isLoading && (
          <p className="text-sm text-muted-foreground text-center py-8">
            Cargando reservas...
          </p>
        )}
        {!reservasQ.isLoading && grupos.length === 0 && (
          <div className="rounded-lg border border-dashed p-10 text-center">
            <CalendarDays className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">
              No hay reservas para esta búsqueda.
            </p>
          </div>
        )}
        {grupos.map(([hora, list]) => (
          <section key={hora} className="space-y-2">
            <h2 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
              {hora} · {list.length} {list.length === 1 ? "reserva" : "reservas"}
            </h2>
            <div className="space-y-2">
              {list.map((r) => (
                <ReservaCard key={r.id_reserva} reserva={r} onEdit={openEdit} />
              ))}
            </div>
          </section>
        ))}
      </div>

      <ReservaFormSheet
        open={formOpen}
        onOpenChange={setFormOpen}
        reserva={editing}
      />
    </div>
  );
}
