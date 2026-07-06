import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getComportamientoCliente } from "@/lib/analytics.functions";
import { formatMoney } from "@/lib/format";
import { Heatmap } from "./heatmap";
import { POLL } from "@/lib/query-config";

export function ClientePanel({ desde, hasta }: { desde: string; hasta: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["comportamiento-cliente", desde, hasta],
    queryFn: () => getComportamientoCliente({ desde, hasta }),
    ...POLL.SLOW,
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Analizando comportamiento…</p>;
  if (!data) return null;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Ticket promedio por mesa</CardTitle></CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{formatMoney(data.ticket_promedio_mesa)}</div>
            <p className="text-xs text-muted-foreground mt-1">{data.mesas_cerradas} mesas cerradas</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Tasa de upselling</CardTitle></CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{data.upselling_pct.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground mt-1">{data.pedidos_con_extras} / {data.pedidos_totales} pedidos con extras</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Ventas del período</CardTitle></CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{formatMoney(data.ventas_totales)}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Mapa de calor · Horas pico</CardTitle>
          <p className="text-xs text-muted-foreground">Intensidad por monto de ventas (día × hora)</p>
        </CardHeader>
        <CardContent>
          <Heatmap data={data.heatmap} />
        </CardContent>
      </Card>
    </div>
  );
}
