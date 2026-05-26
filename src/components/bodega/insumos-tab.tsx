import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
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
import { ResponsiveSheet } from "@/components/ui/responsive-sheet";
import { InsumoForm } from "./insumo-form";
import { labelDe } from "@/lib/unidades";

interface Insumo {
  id_insumo: string;
  nombre_insumo: string;
  costo_promedio: number;
  stock_minimo: number;
  unidad_compra: string;
  unidad_receta: string;
  factor_conversion: number;
}

export function InsumosTab({ idNegocio }: { idNegocio: string }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Insumo | null>(null);
  const [items, setItems] = useState<Insumo[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("insumos")
      .select(
        "id_insumo, nombre_insumo, costo_promedio, stock_minimo, unidad_compra, unidad_receta, factor_conversion"
      )
      .order("created_at", { ascending: false });
    setItems((data as unknown as Insumo[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [idNegocio]);

  const openNew = () => {
    setSelected(null);
    setOpen(true);
  };

  const openEdit = (i: Insumo) => {
    setSelected(i);
    setOpen(true);
  };

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) setSelected(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Insumos</h2>
          <p className="text-sm text-muted-foreground">
            Productos base que usas en tus recetas o reventas.
          </p>
        </div>
        <Button onClick={openNew} size="sm">
          <Plus className="h-4 w-4 mr-1" /> Nuevo
        </Button>
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Insumo</TableHead>
              <TableHead className="hidden sm:table-cell">Unidad</TableHead>
              <TableHead className="text-right">Costo prom.</TableHead>
              <TableHead className="hidden md:table-cell text-right">Stock mín.</TableHead>
              <TableHead className="hidden lg:table-cell">Compra → Receta</TableHead>
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
                <TableRow
                  key={i.id_insumo}
                  className="cursor-pointer"
                  onClick={() => openEdit(i)}
                >
                  <TableCell className="font-medium">{i.nombre_insumo}</TableCell>
                  <TableCell className="hidden sm:table-cell">{labelDe(i.unidad_receta)}</TableCell>
                  <TableCell className="text-right">
                    {Number(i.costo_promedio).toLocaleString()}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-right">
                    {Number(i.stock_minimo).toLocaleString()}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    {labelDe(i.unidad_compra)} → {labelDe(i.unidad_receta)}
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
        onOpenChange={handleOpenChange}
        title={selected ? "Editar insumo" : "Nuevo insumo"}
        description={
          selected
            ? "Actualiza los datos del insumo."
            : "Define las unidades de compra, receta y factor de conversión."
        }
      >
        <InsumoForm
          key={selected?.id_insumo ?? "new"}
          idNegocio={idNegocio}
          idInsumo={selected?.id_insumo}
          initialValues={
            selected
              ? {
                  nombre_insumo: selected.nombre_insumo,
                  costo_promedio: selected.costo_promedio,
                  stock_minimo: selected.stock_minimo,
                  unidad_compra: selected.unidad_compra,
                  unidad_receta: selected.unidad_receta,
                  factor_conversion: selected.factor_conversion,
                }
              : undefined
          }
          onSuccess={() => {
            handleOpenChange(false);
            load();
          }}
          onCancel={() => handleOpenChange(false)}
          onDelete={
            selected
              ? async () => {
                  const { error } = await supabase
                    .from("insumos")
                    .delete()
                    .eq("id_insumo", selected.id_insumo);
                  if (error) {
                    toast.error("No se pudo eliminar", { description: error.message });
                    return;
                  }
                  toast.success("Insumo eliminado");
                  handleOpenChange(false);
                  load();
                }
              : undefined
          }
        />
      </ResponsiveSheet>
    </div>
  );
}
