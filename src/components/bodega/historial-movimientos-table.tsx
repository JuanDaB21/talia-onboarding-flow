import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export interface MovimientoRow {
  id_movimiento: string;
  created_at: string;
  tipo_movimiento: string;
  cantidad: number;
  cantidad_anterior: number;
  cantidad_nueva: number;
  motivo: string | null;
  referencia_id: string | null;
  usuarios_staff: { nombre: string } | null;
  id_bodega_origen?: string | null;
  id_bodega_destino?: string | null;
  bodega_origen?: { nombre: string } | null;
  bodega_destino?: { nombre: string } | null;
}

interface Props {
  rows: MovimientoRow[];
  loading: boolean;
  unidad: string;
  onSelectCompra: (idCompra: string) => void;
}

function tipoBadge(tipo: string, cantidad: number) {
  const isEntrada = Number(cantidad) >= 0;
  switch (tipo) {
    case "COMPRA":
      return <Badge className="bg-emerald-600 hover:bg-emerald-600">Compra</Badge>;
    case "AJUSTE_MANUAL":
      return (
        <Badge variant="secondary" className="bg-amber-100 text-amber-900 hover:bg-amber-100">
          {isEntrada ? "Ajuste +" : "Ajuste −"}
        </Badge>
      );
    case "TRASLADO_ENTRADA":
      return (
        <Badge variant="secondary" className="bg-sky-100 text-sky-900 hover:bg-sky-100">
          Traslado +
        </Badge>
      );
    case "TRASLADO_SALIDA":
      return (
        <Badge variant="secondary" className="bg-sky-100 text-sky-900 hover:bg-sky-100">
          Traslado −
        </Badge>
      );
    case "VENTA":
      return <Badge variant="destructive">Venta</Badge>;
    case "CONSUMO":
    case "CONSUMO_PREPARACION":
      return <Badge variant="destructive">Consumo</Badge>;
    case "MERMA":
      return <Badge variant="destructive">Merma</Badge>;
    default:
      return <Badge variant="outline">{tipo}</Badge>;
  }
}

function formatFecha(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function bodegaLabel(r: MovimientoRow): string | null {
  const origen = r.bodega_origen?.nombre;
  const destino = r.bodega_destino?.nombre;
  if (origen && destino) return `${origen} → ${destino}`;
  if (destino) return destino;
  if (origen) return origen;
  return null;
}

export function HistorialMovimientosTable({ rows, loading, unidad, onSelectCompra }: Props) {
  return (
    <div className="rounded-md border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Fecha</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead className="text-right">Cantidad</TableHead>
            <TableHead className="hidden md:table-cell">Bodega</TableHead>
            <TableHead className="hidden md:table-cell text-right">Anterior → Nuevo</TableHead>
            <TableHead className="hidden sm:table-cell">Motivo</TableHead>
            <TableHead className="hidden md:table-cell">Usuario</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">
                Cargando…
              </TableCell>
            </TableRow>
          ) : rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">
                Aún no hay movimientos para este insumo.
              </TableCell>
            </TableRow>
          ) : (
            rows.map((r) => {
              const cantidad = Number(r.cantidad);
              const isEntrada = cantidad >= 0;
              const clickable = r.tipo_movimiento === "COMPRA" && r.referencia_id;
              const label = bodegaLabel(r);
              return (
                <TableRow
                  key={r.id_movimiento}
                  className={clickable ? "cursor-pointer" : undefined}
                  onClick={() => {
                    if (clickable && r.referencia_id) onSelectCompra(r.referencia_id);
                  }}
                >
                  <TableCell className="whitespace-nowrap text-sm">
                    {formatFecha(r.created_at)}
                  </TableCell>
                  <TableCell>{tipoBadge(r.tipo_movimiento, cantidad)}</TableCell>
                  <TableCell
                    className={cn(
                      "text-right tabular-nums font-medium",
                      isEntrada ? "text-emerald-600" : "text-destructive",
                    )}
                  >
                    {isEntrada ? "+" : ""}
                    {cantidad.toLocaleString()} {unidad}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-sm">
                    {label ?? "—"}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-right tabular-nums text-sm text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      {Number(r.cantidad_anterior).toLocaleString()}
                      <ArrowRight className="h-3 w-3" />
                      <span className="text-foreground font-medium">
                        {Number(r.cantidad_nueva).toLocaleString()}
                      </span>
                    </span>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-sm max-w-[280px] truncate">
                    {r.motivo ?? "—"}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-sm">
                    {r.usuarios_staff?.nombre ?? "—"}
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
