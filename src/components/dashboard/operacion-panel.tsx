import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getEficienciaOperativa } from "@/lib/analytics.functions";
import { formatMoney } from "@/lib/format";
import { POLL } from "@/lib/query-config";

export function OperacionPanel({ desde, hasta }: { desde: string; hasta: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["eficiencia-operativa", desde, hasta],
    queryFn: () => getEficienciaOperativa({ desde, hasta }),
    ...POLL.SLOW,
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Midiendo eficiencia…</p>;
  if (!data) return null;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Ciclo de mesa promedio</CardTitle></CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {data.ciclo_mesa_prom_min != null ? `${Math.round(data.ciclo_mesa_prom_min)} min` : "—"}
            </div>
            <p className="text-xs text-muted-foreground mt-1">{data.ciclo_mesa_muestras} cierres</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Cuellos de cocina (top desviación)</CardTitle></CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{data.productos_lentos.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Productos por encima de su tiempo planeado</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Top productos lentos</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Producto</TableHead>
                <TableHead>Destino</TableHead>
                <TableHead className="text-right">Tiempo real</TableHead>
                <TableHead className="text-right">Planeado</TableHead>
                <TableHead className="text-right">Desviación</TableHead>
                <TableHead className="text-right">Muestras</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.productos_lentos.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Sin datos</TableCell></TableRow>
              )}
              {data.productos_lentos.map((p) => (
                <TableRow key={p.id_producto}>
                  <TableCell className="font-medium">{p.nombre}</TableCell>
                  <TableCell><Badge variant="outline">{p.destino ?? "—"}</Badge></TableCell>
                  <TableCell className="text-right">{p.tiempo_real_prom.toFixed(1)} min</TableCell>
                  <TableCell className="text-right">{p.tiempo_planeado_prom.toFixed(1)} min</TableCell>
                  <TableCell className="text-right">
                    <span className={p.desviacion_min > 0 ? "text-destructive font-semibold" : "text-emerald-600"}>
                      {p.desviacion_min > 0 ? "+" : ""}{p.desviacion_min.toFixed(1)} min
                    </span>
                  </TableCell>
                  <TableCell className="text-right">{p.muestras}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Rendimiento por mesero</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mesero</TableHead>
                <TableHead className="text-right">Mesas atendidas</TableHead>
                <TableHead className="text-right">Tiempo respuesta</TableHead>
                <TableHead className="text-right">Total vendido</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.meseros.length === 0 && (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Sin meseros</TableCell></TableRow>
              )}
              {data.meseros.map((m) => (
                <TableRow key={m.id_usuario}>
                  <TableCell className="font-medium">{m.nombre}</TableCell>
                  <TableCell className="text-right">{m.mesas_atendidas}</TableCell>
                  <TableCell className="text-right">
                    {m.tiempo_resp_prom_min != null ? `${m.tiempo_resp_prom_min.toFixed(1)} min` : "—"}
                  </TableCell>
                  <TableCell className="text-right font-semibold">{formatMoney(m.total_vendido)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
