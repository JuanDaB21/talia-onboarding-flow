import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ResponsiveSheet } from "@/components/ui/responsive-sheet";
import { Badge } from "@/components/ui/badge";
import { labelDe } from "@/lib/unidades";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Props {
  idCompra: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Compra {
  id_compra: string;
  numero_factura: string | null;
  fecha_compra: string;
  estado: string;
  total: number;
  observaciones: string | null;
  proveedores: { razon_social: string } | null;
}

interface Detalle {
  id_detalle: string;
  cantidad: number;
  precio_unitario_compra: number;
  subtotal: number;
  insumos: { nombre_insumo: string; unidad_compra: string } | null;
}

export function CompraDetailSheet({ idCompra, open, onOpenChange }: Props) {
  const [compra, setCompra] = useState<Compra | null>(null);
  const [detalles, setDetalles] = useState<Detalle[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !idCompra) return;
    (async () => {
      setLoading(true);
      const [{ data: c }, { data: d }] = await Promise.all([
        supabase
          .from("compras")
          .select(
            "id_compra, numero_factura, fecha_compra, estado, total, observaciones, proveedores:id_proveedor(razon_social)"
          )
          .eq("id_compra", idCompra)
          .maybeSingle(),
        supabase
          .from("detalle_compra")
          .select(
            "id_detalle, cantidad, precio_unitario_compra, subtotal, insumos:id_insumo(nombre_insumo, unidad_compra)"
          )
          .eq("id_compra", idCompra),
      ]);
      setCompra((c as unknown as Compra) ?? null);
      setDetalles((d as unknown as Detalle[]) ?? []);
      setLoading(false);
    })();
  }, [open, idCompra]);

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Detalle de compra"
      description={compra?.numero_factura ? `Factura ${compra.numero_factura}` : "Compra"}
    >
      {loading || !compra ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Proveedor</p>
              <p className="font-medium">{compra.proveedores?.razon_social ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Fecha</p>
              <p className="font-medium">{compra.fecha_compra}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Factura</p>
              <p className="font-medium">{compra.numero_factura ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Estado</p>
              <Badge variant="secondary">{compra.estado}</Badge>
            </div>
            <div className="col-span-2">
              <p className="text-xs text-muted-foreground">Total</p>
              <p className="font-semibold text-lg tabular-nums">
                {Number(compra.total).toLocaleString()}
              </p>
            </div>
            {compra.observaciones && (
              <div className="col-span-2">
                <p className="text-xs text-muted-foreground">Observaciones</p>
                <p className="text-sm">{compra.observaciones}</p>
              </div>
            )}
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Insumo</TableHead>
                  <TableHead className="text-right">Cant.</TableHead>
                  <TableHead className="text-right">V. unit.</TableHead>
                  <TableHead className="text-right">Subtotal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detalles.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-6">
                      Sin ítems.
                    </TableCell>
                  </TableRow>
                ) : (
                  detalles.map((d) => (
                    <TableRow key={d.id_detalle}>
                      <TableCell className="font-medium">
                        {d.insumos?.nombre_insumo ?? "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {Number(d.cantidad).toLocaleString()} {labelDe(d.insumos?.unidad_compra)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {Number(d.precio_unitario_compra).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {Number(d.subtotal).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </ResponsiveSheet>
  );
}
