import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ResponsiveSheet } from "./responsive-sheet";
import { InsumoForm } from "./insumo-form";

interface Insumo {
  id_insumo: string;
  nombre_insumo: string;
  unidad_medida: string;
  costo_promedio: number;
  stock_minimo: number;
  unidad_compra: string;
  unidad_receta: string;
  factor_conversion: number;
}

export function InsumosTab({ idNegocio }: { idNegocio: string }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Insumo[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("insumos")
      .select(
        "id_insumo, nombre_insumo, unidad_medida, costo_promedio, stock_minimo, unidad_compra, unidad_receta, factor_conversion"
      )
      .order("created_at", { ascending: false });
    setItems((data as Insumo[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [idNegocio]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Insumos</h2>
          <p className="text-sm text-muted-foreground">
            Productos base que usas en tus recetas o reventas.
          </p>
        </div>
        <Button onClick={() => setOpen(true)} size="sm">
          <Plus className="h-4 w-4 mr-1" /> Nuevo
        </Button>
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Insumo</TableHead>
              <TableHead className="hidden sm:table-cell">U. medida</TableHead>
              <TableHead className="text-right">Costo prom.</TableHead>
              <TableHead className="hidden md:table-cell text-right">Stock mín.</TableHead>
              <TableHead className="hidden lg:table-cell">Compra / Receta</TableHead>
              <TableHead className="hidden lg:table-cell text-right">Factor</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">
                  Cargando…
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">
                  Aún no hay insumos. Crea el primero.
                </TableCell>
              </TableRow>
            ) : (
              items.map((i) => (
                <TableRow key={i.id_insumo}>
                  <TableCell className="font-medium">{i.nombre_insumo}</TableCell>
                  <TableCell className="hidden sm:table-cell">{i.unidad_medida}</TableCell>
                  <TableCell className="text-right">
                    {Number(i.costo_promedio).toLocaleString()}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-right">
                    {Number(i.stock_minimo).toLocaleString()}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    {i.unidad_compra} → {i.unidad_receta}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-right">
                    {Number(i.factor_conversion).toLocaleString()}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <ResponsiveSheet
        open={open}
        onOpenChange={setOpen}
        title="Nuevo insumo"
        description="Define las unidades de compra, receta y factor de conversión."
      >
        <InsumoForm
          idNegocio={idNegocio}
          onSuccess={() => {
            setOpen(false);
            load();
          }}
          onCancel={() => setOpen(false)}
        />
      </ResponsiveSheet>
    </div>
  );
}
