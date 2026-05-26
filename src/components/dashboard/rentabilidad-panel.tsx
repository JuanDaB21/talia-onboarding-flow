
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getIngenieriaMenu, type Cuadrante, type ProductoMenu } from "@/lib/analytics.functions";
import { formatMoney } from "@/lib/format";
import type { Rango } from "./range-selector";
import { Star, TrendingDown, HelpCircle, Dog } from "lucide-react";
import { POLL } from "@/lib/query-config";

const CUAD_META: Record<Cuadrante, { label: string; desc: string; icon: typeof Star; cls: string }> = {
  STAR: { label: "Estrellas", desc: "Alta rentabilidad y popularidad. Manténlos visibles.", icon: Star, cls: "bg-amber-500/10 text-amber-700 border-amber-300 dark:text-amber-300" },
  PLOWHORSE: { label: "Caballitos de batalla", desc: "Muy vendidos pero baja rentabilidad. Reduce costo.", icon: TrendingDown, cls: "bg-blue-500/10 text-blue-700 border-blue-300 dark:text-blue-300" },
  PUZZLE: { label: "Rompecabezas", desc: "Rentables pero poco vendidos. Impulsa o destaca.", icon: HelpCircle, cls: "bg-purple-500/10 text-purple-700 border-purple-300 dark:text-purple-300" },
  DOG: { label: "Perros", desc: "Bajo todo. Candidatos a eliminar.", icon: Dog, cls: "bg-destructive/10 text-destructive border-destructive/30" },
};

export function RentabilidadPanel({ rango }: { rango: Rango }) {
  const fn = useServerFn(getIngenieriaMenu);
  const { data, isLoading } = useQuery({
    queryKey: ["ingenieria-menu", rango],
    queryFn: () => fn({ data: { rango } }),
    ...POLL.SLOW,
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Calculando ingeniería del menú…</p>;
  if (!data) return null;

  const fc = data.food_cost_pct;
  const fcColor = fc === 0 ? "text-muted-foreground" : fc < 25 || fc > 38 ? "text-destructive" : fc > 33 ? "text-amber-600" : "text-emerald-600";

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Food Cost % global</CardTitle></CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold ${fcColor}`}>{fc.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground mt-1">Saludable: 28–33%</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Margen promedio</CardTitle></CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{data.margen_promedio_pct.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground mt-1">Por producto</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Ingresos del período</CardTitle></CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{formatMoney(data.ingresos_totales)}</div>
            <p className="text-xs text-muted-foreground mt-1">Costo: {formatMoney(data.costo_total)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Ganancia neta</CardTitle></CardHeader>
          <CardContent>
            {(() => {
              const ganancia = data.ingresos_totales - data.costo_total;
              const pct = data.ingresos_totales > 0 ? (ganancia / data.ingresos_totales) * 100 : 0;
              const cls = ganancia < 0 ? "text-destructive" : "text-emerald-600";
              return (
                <>
                  <div className={`text-3xl font-bold ${cls}`}>{formatMoney(ganancia)}</div>
                  <p className="text-xs text-muted-foreground mt-1">Margen: {pct.toFixed(1)}%</p>
                </>
              );
            })()}
          </CardContent>
        </Card>
      </div>


      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {(["STAR", "PLOWHORSE", "PUZZLE", "DOG"] as Cuadrante[]).map((c) => {
          const meta = CUAD_META[c];
          const Icon = meta.icon;
          const top = data.productos.filter((p) => p.cuadrante === c).slice(0, 3);
          return (
            <Card key={c} className={`border ${meta.cls.split(" ").find((x) => x.startsWith("border")) ?? ""}`}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">{meta.label}</CardTitle>
                  <Icon className="h-4 w-4" />
                </div>
                <Badge variant="outline" className="w-fit">{data.conteo_por_cuadrante[c]} productos</Badge>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground mb-2">{meta.desc}</p>
                <ul className="space-y-1 text-xs">
                  {top.length === 0 && <li className="text-muted-foreground">Sin productos</li>}
                  {top.map((p) => (
                    <li key={p.id_producto} className="truncate">• {p.nombre}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Detalle por producto</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Producto</TableHead>
                <TableHead className="text-right">Unidades</TableHead>
                <TableHead className="text-right">Precio</TableHead>
                <TableHead className="text-right">Costo</TableHead>
                <TableHead className="text-right">Margen</TableHead>
                <TableHead className="text-right">%</TableHead>
                <TableHead>Cuadrante</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.productos.map((p: ProductoMenu) => (
                <TableRow key={p.id_producto}>
                  <TableCell className="font-medium">{p.nombre}</TableCell>
                  <TableCell className="text-right">{p.unidades}</TableCell>
                  <TableCell className="text-right">{formatMoney(p.precio)}</TableCell>
                  <TableCell className="text-right">{formatMoney(p.costo)}</TableCell>
                  <TableCell className="text-right">{formatMoney(p.margen_unit)}</TableCell>
                  <TableCell className="text-right">{p.margen_pct.toFixed(0)}%</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={CUAD_META[p.cuadrante].cls}>{CUAD_META[p.cuadrante].label}</Badge>
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
