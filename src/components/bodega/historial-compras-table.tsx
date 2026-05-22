import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export interface HistorialRow {
  id_detalle: string;
  cantidad: number;
  precio_unitario_compra: number;
  compras: {
    id_compra: string;
    fecha_compra: string;
    numero_factura: string | null;
    proveedores: { razon_social: string } | null;
  } | null;
}

interface Props {
  rows: HistorialRow[];
  loading: boolean;
  onSelect: (idCompra: string) => void;
}

export function HistorialComprasTable({ rows, loading, onSelect }: Props) {
  return (
    <div className="rounded-md border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Fecha</TableHead>
            <TableHead className="hidden sm:table-cell"># Factura</TableHead>
            <TableHead>Proveedor</TableHead>
            <TableHead className="text-right">Cantidad</TableHead>
            <TableHead className="text-right">V. unitario</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">
                Cargando…
              </TableCell>
            </TableRow>
          ) : rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">
                Aún no hay compras registradas para este insumo.
              </TableCell>
            </TableRow>
          ) : (
            rows.map((r) => (
              <TableRow
                key={r.id_detalle}
                className="cursor-pointer"
                onClick={() => r.compras && onSelect(r.compras.id_compra)}
              >
                <TableCell>{r.compras?.fecha_compra ?? "—"}</TableCell>
                <TableCell className="hidden sm:table-cell">
                  {r.compras?.numero_factura ?? "—"}
                </TableCell>
                <TableCell className="font-medium">
                  {r.compras?.proveedores?.razon_social ?? "—"}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {Number(r.cantidad).toLocaleString()}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {Number(r.precio_unitario_compra).toLocaleString()}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
