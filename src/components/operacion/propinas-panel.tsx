import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Coins } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getPropinasPorUsuario } from "@/lib/propinas.functions";
import { getNegocioConfig } from "@/lib/negocio.functions";
import { formatMoney } from "@/lib/format";
import { POLL } from "@/lib/query-config";

function hoyIso() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function PropinasPanel() {
  const [desde, setDesde] = useState(hoyIso());
  const [hasta, setHasta] = useState(hoyIso());

  const { data, isLoading } = useQuery({
    queryKey: ["propinas-por-usuario", desde, hasta],
    queryFn: () => getPropinasPorUsuario({ desde, hasta }),
    ...POLL.NORMAL,
  });

  const { data: cfg } = useQuery({
    queryKey: ["negocio-config"],
    queryFn: () => getNegocioConfig(),
  });

  const filas = data?.filas ?? [];
  const total = filas.reduce((acc, f) => acc + f.total_propinas, 0);
  const retencion = Number(cfg?.porcentaje_retencion_propina ?? 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Coins className="h-4 w-4" /> Propinas por usuario
          <Badge variant="secondary">{formatMoney(total)}</Badge>
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          El negocio retiene {retencion}% · se reparte{" "}
          {(100 - retencion).toFixed(retencion % 1 ? 2 : 0)}% entre meseros en turno.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label htmlFor="prop-desde" className="text-xs">
              Desde
            </Label>
            <Input
              id="prop-desde"
              type="date"
              value={desde}
              max={hasta}
              onChange={(e) => setDesde(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="prop-hasta" className="text-xs">
              Hasta
            </Label>
            <Input
              id="prop-hasta"
              type="date"
              value={hasta}
              min={desde}
              onChange={(e) => setHasta(e.target.value)}
            />
          </div>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuario</TableHead>
                <TableHead className="text-center">Días</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-sm text-muted-foreground py-6">
                    Cargando…
                  </TableCell>
                </TableRow>
              ) : filas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-sm text-muted-foreground py-6">
                    Nadie marcado como receptor de propinas en este rango.
                  </TableCell>
                </TableRow>
              ) : (
                filas.map((f) => (
                  <TableRow key={f.id_usuario}>
                    <TableCell>
                      <div className="text-sm font-medium">{f.nombre}</div>
                      <div className="text-xs text-muted-foreground">{f.rol}</div>
                    </TableCell>
                    <TableCell className="text-center">{f.dias_activos}</TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatMoney(f.total_propinas)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
