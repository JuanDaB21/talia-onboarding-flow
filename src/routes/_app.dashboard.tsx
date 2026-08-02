import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { DollarSign, Receipt, Users, Timer, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { AdminGate } from "@/components/admin/admin-gate";
import { getKpis } from "@/lib/admin.functions";
import { formatMoney } from "@/lib/format";
import {
  RangeSelector,
  type DateRangeValue,
  presetToDates,
} from "@/components/dashboard/range-selector";
import { RentabilidadPanel } from "@/components/dashboard/rentabilidad-panel";
import { ClientePanel } from "@/components/dashboard/cliente-panel";
import { OperacionPanel } from "@/components/dashboard/operacion-panel";
import { AlertasPanel } from "@/components/dashboard/alertas-panel";
import { POLL } from "@/lib/query-config";

const searchSchema = z.object({
  tab: z
    .enum(["rentabilidad", "cliente", "operacion", "alertas"])
    .optional()
    .default("rentabilidad"),
  rango: z.enum(["hoy", "7d", "30d", "custom"]).optional().default("hoy"),
  desde: z.string().optional(),
  hasta: z.string().optional(),
});

function resolveRange(search: z.infer<typeof searchSchema>): Required<DateRangeValue> {
  const rango = search.rango ?? "hoy";
  if (rango === "custom" && search.desde && search.hasta) {
    return { rango, desde: search.desde, hasta: search.hasta };
  }
  const { desde, hasta } = presetToDates(rango);
  return { rango, desde: desde.toISOString(), hasta: hasta.toISOString() };
}

export const Route = createFileRoute("/_app/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Talia" }] }),
  validateSearch: searchSchema,
  component: () => (
    <AdminGate>
      <DashboardPage />
    </AdminGate>
  ),
});

function DashboardPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const range = resolveRange(search);

  const { data, isLoading } = useQuery({
    queryKey: ["kpis", range.desde, range.hasta],
    queryFn: () => getKpis({ desde: range.desde, hasta: range.hasta }),
    ...POLL.NORMAL,
  });

  // El bloque superior deja de ser "solo hoy": ventas, ticket y tiempo de prep siguen
  // el mismo rango que la analítica de abajo. La ocupación es la excepción (dato en vivo).
  const esHoy = range.rango === "hoy";

  const setRange = (v: DateRangeValue) => {
    navigate({ search: { tab: search.tab, rango: v.rango, desde: v.desde, hasta: v.hasta } });
  };

  const setTab = (t: string) =>
    navigate({
      search: {
        tab: t as "rentabilidad" | "cliente" | "operacion" | "alertas",
        rango: range.rango,
        desde: range.desde,
        hasta: range.hasta,
      },
    });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Resumen del día y analítica</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link to="/operacion">
              Operación en vivo <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
          <Button asChild>
            <Link to="/caja">
              Ir a caja <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          icon={<DollarSign className="h-4 w-4" />}
          label={esHoy ? "Ventas del día" : "Ventas del periodo"}
          value={isLoading ? "…" : formatMoney(data?.ventas_dia ?? 0)}
          hint={`${data?.mesas_cerradas ?? 0} mesa(s) cerradas`}
        />
        <Kpi
          icon={<Receipt className="h-4 w-4" />}
          label="Ticket promedio"
          value={isLoading ? "…" : formatMoney(data?.ticket_promedio ?? 0)}
        />
        <Kpi
          icon={<Users className="h-4 w-4" />}
          label="Ocupación"
          value={isLoading ? "…" : `${Math.round(data?.ocupacion_pct ?? 0)}%`}
          hint={`${data?.mesas_ocupadas ?? 0} / ${data?.mesas_totales ?? 0} mesas · en vivo`}
        />
        <Kpi
          icon={<Timer className="h-4 w-4" />}
          label="Tiempo prep. promedio"
          value={
            isLoading
              ? "…"
              : data?.tiempo_prep_real_min != null
                ? `${Math.round(data.tiempo_prep_real_min)} min`
                : "—"
          }
          hint={
            data?.tiempo_prep_planeado_min != null
              ? `Planeado: ${Math.round(data.tiempo_prep_planeado_min)} min`
              : undefined
          }
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <h2 className="text-lg font-semibold tracking-tight">Analítica</h2>
        <RangeSelector value={range} onChange={setRange} />
      </div>

      <Tabs value={search.tab} onValueChange={setTab}>
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4">
          <TabsTrigger value="rentabilidad">Rentabilidad</TabsTrigger>
          <TabsTrigger value="cliente">Cliente</TabsTrigger>
          <TabsTrigger value="operacion">Operación</TabsTrigger>
          <TabsTrigger value="alertas">Alertas</TabsTrigger>
        </TabsList>
        <TabsContent value="rentabilidad" className="mt-6">
          <RentabilidadPanel desde={range.desde} hasta={range.hasta} />
        </TabsContent>
        <TabsContent value="cliente" className="mt-6">
          <ClientePanel desde={range.desde} hasta={range.hasta} />
        </TabsContent>
        <TabsContent value="operacion" className="mt-6">
          <OperacionPanel desde={range.desde} hasta={range.hasta} />
        </TabsContent>
        <TabsContent value="alertas" className="mt-6">
          <AlertasPanel desde={range.desde} hasta={range.hasta} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Kpi({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <div className="text-muted-foreground">{icon}</div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}
