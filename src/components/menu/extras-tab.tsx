import { useCallback, useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface ExtraRow {
  id_extra: string;
  cantidad_porcion: number;
  precio_extra: number;
  productos: { id_producto: string; nombre_producto: string } | null;
  insumos: { nombre_insumo: string; unidad_receta: string } | null;
}

export function ExtrasTab() {
  const [rows, setRows] = useState<ExtraRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("extras_permitidos")
      .select("id_extra, cantidad_porcion, precio_extra, productos(id_producto, nombre_producto), insumos:insumos!extras_permitidos_id_insumo_extra_fkey(nombre_insumo, unidad_receta)")
      .order("id_extra");
    if (error) toast.error("Error", { description: error.message });
    setRows((data as unknown as ExtraRow[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const eliminar = async (id: string) => {
    const { error } = await supabase.from("extras_permitidos").delete().eq("id_extra", id);
    if (error) return toast.error("No se pudo eliminar", { description: error.message });
    toast.success("Extra eliminado");
    load();
  };

  // Agrupar por producto
  const agrupado = rows.reduce<Record<string, { nombre: string; items: ExtraRow[] }>>((acc, r) => {
    const id = r.productos?.id_producto ?? "—";
    const nombre = r.productos?.nombre_producto ?? "Sin producto";
    if (!acc[id]) acc[id] = { nombre, items: [] };
    acc[id].items.push(r);
    return acc;
  }, {});

  if (loading) return <p className="text-sm text-muted-foreground">Cargando…</p>;
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-8">
      Aún no hay extras configurados. Edita un producto para añadir extras.
    </p>;
  }

  return (
    <div className="space-y-4">
      {Object.entries(agrupado).map(([id, grp]) => (
        <div key={id} className="rounded-md border bg-card animate-fade-in">
          <div className="border-b px-3 py-2.5">
            <h3 className="font-semibold text-sm">{grp.nombre}</h3>
            <p className="text-xs text-muted-foreground">{grp.items.length} extra(s)</p>
          </div>
          <div className="divide-y">
            {grp.items.map((e) => (
              <div key={e.id_extra} className="flex items-center justify-between gap-3 p-3">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{e.insumos?.nombre_insumo ?? "—"}</p>
                  <p className="text-xs text-muted-foreground">
                    {Number(e.cantidad_porcion)} {e.insumos?.unidad_receta ?? ""}
                  </p>
                </div>
                <Badge variant="secondary" className="tabular-nums">+${Number(e.precio_extra).toLocaleString()}</Badge>
                <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => eliminar(e.id_extra)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
