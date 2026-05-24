import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, XCircle, Flame } from "lucide-react";
import { getAlertasFugas } from "@/lib/analytics.functions";
import { cn } from "@/lib/utils";
import type { Rango } from "./range-selector";

export function AlertasPanel({ rango }: { rango: Rango }) {
  const fn = useServerFn(getAlertasFugas);
  const { data, isLoading } = useQuery({
    queryKey: ["alertas-fugas", rango],
    queryFn: () => fn({ data: { rango } }),
    refetchInterval: 10_000,
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Cargando alertas…</p>;
  if (!data) return null;

  const enCuello = data.cuello_botella > data.cuello_umbral;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-destructive/40 bg-destructive/5">
          <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs text-muted-foreground">Items cancelados</CardTitle>
            <XCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-destructive">{data.items_cancelados}</div>
            <p className="text-xs text-muted-foreground mt-1">En el período</p>
          </CardContent>
        </Card>

        <Card className={cn("border-orange-400/40 bg-orange-500/5", enCuello && "animate-pulse")}>
          <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs text-muted-foreground">Cuello de botella (vivo)</CardTitle>
            <Flame className={cn("h-4 w-4", enCuello ? "text-destructive" : "text-orange-500")} />
          </CardHeader>
          <CardContent>
            <div className={cn("text-3xl font-bold", enCuello ? "text-destructive" : "text-orange-600")}>
              {data.cuello_botella}
            </div>
            <p className="text-xs text-muted-foreground mt-1">items en cocina · umbral {data.cuello_umbral}</p>
          </CardContent>
        </Card>

        <Card className="border-amber-400/40 bg-amber-500/5">
          <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs text-muted-foreground">Desviaciones de inventario</CardTitle>
            <AlertTriangle className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-amber-700">{data.desviaciones.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Insumos con &gt;5% de diferencia</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Desviación teórico vs. real</CardTitle>
          <p className="text-xs text-muted-foreground">Consumo según recetas vs. movimientos registrados</p>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Insumo</TableHead>
                <TableHead className="text-right">Teórico</TableHead>
                <TableHead className="text-right">Real</TableHead>
                <TableHead className="text-right">Diferencia</TableHead>
                <TableHead className="text-right">%</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.desviaciones.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Sin desviaciones significativas</TableCell></TableRow>
              )}
              {data.desviaciones.map((d) => (
                <TableRow key={d.id_insumo} className={Math.abs(d.diferencia_pct) > 15 ? "bg-destructive/5" : ""}>
                  <TableCell className="font-medium">{d.nombre}</TableCell>
                  <TableCell className="text-right">{d.teorico.toFixed(2)}</TableCell>
                  <TableCell className="text-right">{d.real.toFixed(2)}</TableCell>
                  <TableCell className="text-right">{d.diferencia.toFixed(2)}</TableCell>
                  <TableCell className="text-right font-semibold text-destructive">
                    {d.diferencia_pct > 0 ? "+" : ""}{d.diferencia_pct.toFixed(1)}%
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
