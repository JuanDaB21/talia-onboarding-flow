import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { AlertTriangle, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentNegocio } from "@/hooks/use-current-negocio";
import { labelDe, formatStockInteligente } from "@/lib/unidades";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Row {
  cantidad_actual: number;
  insumos: {
    id_insumo: string;
    nombre_insumo: string;
    unidad_receta: string;
    unidad_compra: string;
    factor_conversion: number;
    stock_minimo: number;
  };
}

type StockFilter = "all" | "low" | "ok";

export function InventarioTab() {
  const navigate = useNavigate();
  const { idNegocio } = useCurrentNegocio();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [unidad, setUnidad] = useState<string>("all");
  const [stockFilter, setStockFilter] = useState<StockFilter>("all");

  const fetchRows = useCallback(async () => {
    const { data } = await supabase
      .from("inventario_actual")
      .select(
        "cantidad_actual, insumos!inner(id_insumo, nombre_insumo, unidad_receta, stock_minimo)"
      );
    setRows((data as unknown as Row[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchRows();
  }, [fetchRows]);

  useEffect(() => {
    if (!idNegocio) return;
    const channel = supabase
      .channel(`inventario-${idNegocio}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "inventario_actual",
          filter: `id_negocio=eq.${idNegocio}`,
        },
        () => {
          fetchRows();
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [idNegocio, fetchRows]);

  const unidades = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => r.insumos?.unidad_receta && set.add(r.insumos.unidad_receta));
    return Array.from(set).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (!r.insumos) return false;
      if (term && !r.insumos.nombre_insumo.toLowerCase().includes(term)) return false;
      if (unidad !== "all" && r.insumos.unidad_receta !== unidad) return false;
      const low = Number(r.cantidad_actual) <= Number(r.insumos.stock_minimo);
      if (stockFilter === "low" && !low) return false;
      if (stockFilter === "ok" && low) return false;
      return true;
    });
  }, [rows, q, unidad, stockFilter]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar insumo…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={unidad} onValueChange={setUnidad}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Unidad" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las unidades</SelectItem>
            {unidades.map((u) => (
              <SelectItem key={u} value={u}>
                {labelDe(u)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={stockFilter} onValueChange={(v) => setStockFilter(v as StockFilter)}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="low">Stock bajo</SelectItem>
            <SelectItem value="ok">Sin alerta</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Insumo</TableHead>
              <TableHead className="text-right">Cantidad actual</TableHead>
              <TableHead className="hidden sm:table-cell">Unidad</TableHead>
              <TableHead className="hidden md:table-cell text-right">Stock mínimo</TableHead>
              <TableHead className="text-right">Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">
                  Cargando…
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">
                  Sin resultados.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((r) => {
                const low = Number(r.cantidad_actual) <= Number(r.insumos.stock_minimo);
                return (
                  <TableRow
                    key={r.insumos.id_insumo}
                    className="cursor-pointer"
                    onClick={() =>
                      navigate({
                        to: "/bodega/inventario/$id",
                        params: { id: r.insumos.id_insumo },
                      })
                    }
                  >
                    <TableCell className="font-medium">{r.insumos.nombre_insumo}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {Number(r.cantidad_actual).toLocaleString()}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {labelDe(r.insumos.unidad_receta)}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-right tabular-nums">
                      {Number(r.insumos.stock_minimo).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      {low ? (
                        <Badge variant="destructive" className="gap-1">
                          <AlertTriangle className="h-3 w-3" /> Alerta
                        </Badge>
                      ) : (
                        <Badge variant="secondary">OK</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
