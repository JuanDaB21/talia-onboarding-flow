import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, History, Search } from "lucide-react";
import { realtime } from "@/lib/realtime-client";
import { listarMovimientos } from "@/lib/bodega.functions";
import { useCurrentNegocio } from "@/hooks/use-current-negocio";
import { labelDe } from "@/lib/unidades";
import { cn } from "@/lib/utils";
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
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/common/loading-state";
import { EmptyState } from "@/components/common/empty-state";
import { CompraDetailSheet } from "@/components/bodega/compra-detail-sheet";

interface MovRow {
  id_movimiento: string;
  created_at: string;
  tipo_movimiento: string;
  cantidad: number;
  cantidad_anterior: number;
  cantidad_nueva: number;
  motivo: string | null;
  referencia_id: string | null;
  id_insumo: string;
  id_usuario: string | null;
  insumos: { id_insumo: string; nombre_insumo: string; unidad_receta: string } | null;
  usuarios_staff: { id_usuario: string; nombre: string } | null;
}

const PAGE_SIZE = 200;

function formatFecha(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
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
    case "VENTA":
      return <Badge variant="destructive">Venta</Badge>;
    case "CONSUMO":
      return <Badge variant="destructive">Consumo</Badge>;
    case "MERMA":
      return <Badge variant="destructive">Merma</Badge>;
    default:
      return <Badge variant="outline">{tipo}</Badge>;
  }
}

export function HistorialInventarioTab() {
  const { idNegocio } = useCurrentNegocio();
  const [rows, setRows] = useState<MovRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [hasMore, setHasMore] = useState(false);
  const [insumoFilter, setInsumoFilter] = useState<string>("all");
  const [usuarioFilter, setUsuarioFilter] = useState<string>("all");
  const [q, setQ] = useState("");
  const [compraSel, setCompraSel] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await listarMovimientos(limit).catch(() => ({ movimientos: [], hasMore: false }));
    setHasMore(res.hasMore);
    setRows((res.movimientos as unknown as MovRow[]) ?? []);
    setLoading(false);
  }, [limit]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!idNegocio) return;
    const channel = realtime
      .channel(`mov-global-${idNegocio}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "movimientos_inventario" },
        () => {
          load();
        },
      )
      .subscribe();
    return () => {
      realtime.removeChannel(channel);
    };
  }, [idNegocio, load]);

  const insumos = useMemo(() => {
    const map = new Map<string, string>();
    rows.forEach((r) => {
      if (r.insumos) map.set(r.insumos.id_insumo, r.insumos.nombre_insumo);
    });
    return Array.from(map.entries())
      .map(([id, nombre]) => ({ id, nombre }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [rows]);

  const usuarios = useMemo(() => {
    const map = new Map<string, string>();
    rows.forEach((r) => {
      if (r.usuarios_staff) map.set(r.usuarios_staff.id_usuario, r.usuarios_staff.nombre);
    });
    return Array.from(map.entries())
      .map(([id, nombre]) => ({ id, nombre }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [rows]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (insumoFilter !== "all" && r.id_insumo !== insumoFilter) return false;
      if (usuarioFilter !== "all" && r.id_usuario !== usuarioFilter) return false;
      if (term) {
        const motivo = (r.motivo ?? "").toLowerCase();
        const nombre = (r.insumos?.nombre_insumo ?? "").toLowerCase();
        const responsable = (r.usuarios_staff?.nombre ?? "").toLowerCase();
        if (!motivo.includes(term) && !nombre.includes(term) && !responsable.includes(term))
          return false;
      }
      return true;
    });
  }, [rows, insumoFilter, usuarioFilter, q]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por insumo, motivo o responsable…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={insumoFilter} onValueChange={setInsumoFilter}>
          <SelectTrigger className="w-full sm:w-56">
            <SelectValue placeholder="Insumo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los insumos</SelectItem>
            {insumos.map((i) => (
              <SelectItem key={i.id} value={i.id}>
                {i.nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={usuarioFilter} onValueChange={setUsuarioFilter}>
          <SelectTrigger className="w-full sm:w-56">
            <SelectValue placeholder="Responsable" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los responsables</SelectItem>
            {usuarios.map((u) => (
              <SelectItem key={u.id} value={u.id}>
                {u.nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <LoadingState />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={History}
          title="Sin movimientos"
          description="Aún no hay movimientos de inventario que coincidan con los filtros."
        />
      ) : (
        <div className="rounded-md border bg-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Insumo</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Cantidad</TableHead>
                <TableHead className="hidden md:table-cell text-right">Anterior → Nuevo</TableHead>
                <TableHead className="hidden sm:table-cell">Motivo</TableHead>
                <TableHead className="hidden sm:table-cell">Responsable</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => {
                const cantidad = Number(r.cantidad);
                const isEntrada = cantidad >= 0;
                const unidad = r.insumos ? labelDe(r.insumos.unidad_receta) : "";
                const clickable = r.tipo_movimiento === "COMPRA" && r.referencia_id;
                return (
                  <TableRow
                    key={r.id_movimiento}
                    className={clickable ? "cursor-pointer" : undefined}
                    onClick={() => {
                      if (clickable && r.referencia_id) setCompraSel(r.referencia_id);
                    }}
                  >
                    <TableCell className="whitespace-nowrap text-sm">
                      {formatFecha(r.created_at)}
                    </TableCell>
                    <TableCell className="font-medium">{r.insumos?.nombre_insumo ?? "—"}</TableCell>
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
                    <TableCell className="hidden sm:table-cell text-sm">
                      {r.usuarios_staff?.nombre ?? "—"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {!loading && hasMore && (
        <div className="flex justify-center">
          <Button variant="outline" onClick={() => setLimit((l) => l + PAGE_SIZE)}>
            Cargar más
          </Button>
        </div>
      )}

      <CompraDetailSheet
        idCompra={compraSel}
        open={Boolean(compraSel)}
        onOpenChange={(o) => !o && setCompraSel(null)}
      />
    </div>
  );
}
