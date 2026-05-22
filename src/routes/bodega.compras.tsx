import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CompraDetailSheet } from "@/components/bodega/compra-detail-sheet";

export const Route = createFileRoute("/bodega/compras")({
  head: () => ({ meta: [{ title: "Compras — Bodega" }] }),
  component: ComprasPage,
});

interface CompraRow {
  id_compra: string;
  fecha_compra: string;
  numero_factura: string | null;
  estado: string;
  total: number;
  proveedores: { razon_social: string } | null;
}

function ComprasPage() {
  const [rows, setRows] = useState<CompraRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("compras")
      .select(
        "id_compra, fecha_compra, numero_factura, estado, total, proveedores:id_proveedor(razon_social)"
      )
      .order("fecha_compra", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(100);
    setRows((data as unknown as CompraRow[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">Compras</h1>
          <p className="text-sm text-muted-foreground">
            Registro de compras y actualización de inventario.
          </p>
        </div>
        <Button asChild>
          <Link to="/bodega/compras/nueva">
            <Plus className="h-4 w-4 mr-1" /> Registrar compra
          </Link>
        </Button>
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead className="hidden sm:table-cell">Factura</TableHead>
              <TableHead>Proveedor</TableHead>
              <TableHead className="hidden sm:table-cell">Estado</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-sm text-muted-foreground">
                  Cargando…
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-sm text-muted-foreground">
                  Aún no has registrado compras.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow
                  key={r.id_compra}
                  className="cursor-pointer"
                  onClick={() => setSelected(r.id_compra)}
                >
                  <TableCell>{r.fecha_compra}</TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {r.numero_factura ?? "—"}
                  </TableCell>
                  <TableCell className="font-medium">
                    {r.proveedores?.razon_social ?? "—"}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <Badge variant="secondary">{r.estado}</Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {Number(r.total).toLocaleString()}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <CompraDetailSheet
        idCompra={selected}
        open={Boolean(selected)}
        onOpenChange={(o) => !o && setSelected(null)}
      />
    </div>
  );
}
