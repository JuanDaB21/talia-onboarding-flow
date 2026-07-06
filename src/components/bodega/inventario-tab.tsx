import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { AlertTriangle, Search } from "lucide-react";
import { realtime } from "@/lib/realtime-client";
import { listarInventarioBodega } from "@/lib/bodega.functions";
import { useCurrentNegocio } from "@/hooks/use-current-negocio";
import { useBodegas } from "@/hooks/use-bodegas";
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

interface InvRow {
  id_bodega: string;
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

interface AggRow {
  id_insumo: string;
  nombre_insumo: string;
  unidad_receta: string;
  unidad_compra: string;
  factor_conversion: number;
  stock_minimo: number;
  total: number;
  por_bodega: { id_bodega: string; nombre: string; cantidad: number }[];
}

type StockFilter = "all" | "low" | "ok";

export function InventarioTab() {
  const navigate = useNavigate();
  const { idNegocio } = useCurrentNegocio();
  const { bodegas } = useBodegas({ soloActivas: true });
  const [rows, setRows] = useState<InvRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [unidad, setUnidad] = useState<string>("all");
  const [stockFilter, setStockFilter] = useState<StockFilter>("all");
  const [bodegaFilter, setBodegaFilter] = useState<string>("all");

  const fetchRows = useCallback(async () => {
    const data = await listarInventarioBodega().catch(() => []);
    setRows((data as unknown as InvRow[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchRows();
  }, [fetchRows]);

  useEffect(() => {
    if (!idNegocio) return;
    const channel = realtime
      .channel(`inventario-bodega-${idNegocio}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "inventario_bodega" }, () => {
        fetchRows();
      })
      .subscribe();
    return () => {
      realtime.removeChannel(channel);
    };
  }, [idNegocio, fetchRows]);

  const bodegaNombre = useMemo(() => {
    const m = new Map<string, string>();
    bodegas.forEach((b) => m.set(b.id_bodega, b.nombre));
    return m;
  }, [bodegas]);

  const aggregated = useMemo<AggRow[]>(() => {
    const map = new Map<string, AggRow>();
    const sourceRows =
      bodegaFilter === "all" ? rows : rows.filter((r) => r.id_bodega === bodegaFilter);
    for (const r of sourceRows) {
      if (!r.insumos) continue;
      const existing = map.get(r.insumos.id_insumo);
      const cantidad = Number(r.cantidad_actual);
      const nombreBodega = bodegaNombre.get(r.id_bodega) ?? "Bodega";
      if (existing) {
        existing.total += cantidad;
        existing.por_bodega.push({ id_bodega: r.id_bodega, nombre: nombreBodega, cantidad });
      } else {
        map.set(r.insumos.id_insumo, {
          id_insumo: r.insumos.id_insumo,
          nombre_insumo: r.insumos.nombre_insumo,
          unidad_receta: r.insumos.unidad_receta,
          unidad_compra: r.insumos.unidad_compra,
          factor_conversion: Number(r.insumos.factor_conversion),
          stock_minimo: Number(r.insumos.stock_minimo),
          total: cantidad,
          por_bodega: [{ id_bodega: r.id_bodega, nombre: nombreBodega, cantidad }],
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.nombre_insumo.localeCompare(b.nombre_insumo));
  }, [rows, bodegaFilter, bodegaNombre]);

  const unidades = useMemo(() => {
    const set = new Set<string>();
    aggregated.forEach((r) => r.unidad_receta && set.add(r.unidad_receta));
    return Array.from(set).sort();
  }, [aggregated]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return aggregated.filter((r) => {
      if (term && !r.nombre_insumo.toLowerCase().includes(term)) return false;
      if (unidad !== "all" && r.unidad_receta !== unidad) return false;
      const minRecetaUnits = r.stock_minimo * (r.factor_conversion || 1);
      const low = r.total <= minRecetaUnits;
      if (stockFilter === "low" && !low) return false;
      if (stockFilter === "ok" && low) return false;
      return true;
    });
  }, [aggregated, q, unidad, stockFilter]);

  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative sm:col-span-2">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar insumo…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={bodegaFilter} onValueChange={setBodegaFilter}>
          <SelectTrigger>
            <SelectValue placeholder="Bodega" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las bodegas</SelectItem>
            {bodegas.map((b) => (
              <SelectItem key={b.id_bodega} value={b.id_bodega}>
                {b.nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="grid grid-cols-2 gap-2">
          <Select value={unidad} onValueChange={setUnidad}>
            <SelectTrigger>
              <SelectValue placeholder="Unidad" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {unidades.map((u) => (
                <SelectItem key={u} value={u}>
                  {labelDe(u)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={stockFilter} onValueChange={(v) => setStockFilter(v as StockFilter)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="low">Stock bajo</SelectItem>
              <SelectItem value="ok">Sin alerta</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Insumo</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="hidden md:table-cell">Ubicación</TableHead>
              <TableHead className="hidden lg:table-cell text-right">Stock mín.</TableHead>
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
                const minRecetaUnits = r.stock_minimo * (r.factor_conversion || 1);
                const low = r.total <= minRecetaUnits;
                const porBodega = r.por_bodega
                  .filter((b) => b.cantidad > 0)
                  .sort((a, b) => b.cantidad - a.cantidad);
                return (
                  <TableRow
                    key={r.id_insumo}
                    className="cursor-pointer"
                    onClick={() =>
                      navigate({
                        to: "/bodega/inventario/$id",
                        params: { id: r.id_insumo },
                      })
                    }
                  >
                    <TableCell className="font-medium">
                      <div>{r.nombre_insumo}</div>
                      <div className="md:hidden mt-1 flex flex-wrap gap-1">
                        {porBodega.length === 0 ? (
                          <span className="text-xs text-muted-foreground">Sin stock</span>
                        ) : (
                          porBodega.map((b) => (
                            <span
                              key={b.id_bodega}
                              className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] tabular-nums"
                            >
                              {b.cantidad.toLocaleString()} · {b.nombre}
                            </span>
                          ))
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatStockInteligente(
                        r.total,
                        r.unidad_receta,
                        r.unidad_compra,
                        r.factor_conversion,
                      )}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {porBodega.length === 0 ? (
                        <span className="text-xs text-muted-foreground">Sin stock</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {porBodega.map((b) => (
                            <span
                              key={b.id_bodega}
                              className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs tabular-nums"
                            >
                              {b.cantidad.toLocaleString()} · {b.nombre}
                            </span>
                          ))}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-right tabular-nums">
                      {r.stock_minimo.toLocaleString()} {labelDe(r.unidad_compra)}
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
