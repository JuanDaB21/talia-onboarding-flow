import { useCallback, useEffect, useState } from "react";
import { Image as ImageIcon, Pencil, Search } from "lucide-react";
import { toast } from "sonner";
import { actualizarProducto, listarProductos } from "@/lib/menu.functions";
import { publicUrl } from "@/lib/storage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ResponsiveSheet } from "@/components/ui/responsive-sheet";
import { ProductoForm } from "./producto-form";

export interface Producto {
  id_producto: string;
  id_receta: string;
  nombre_producto: string;
  descripcion_producto: string | null;
  precio_venta: number;
  url_imagen: string | null;
  activo: boolean;
  facturable: boolean;
}

export function ProductosTab({
  idNegocio,
  autoEditId,
}: {
  idNegocio: string;
  autoEditId?: string;
}) {
  const [items, setItems] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Producto | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listarProductos();
      setItems(data ?? []);
    } catch (e) {
      toast.error("Error al cargar", { description: e instanceof Error ? e.message : undefined });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!autoEditId || items.length === 0) return;
    const match = items.find((p) => p.id_producto === autoEditId);
    if (match) setSelected(match);
  }, [autoEditId, items]);

  const toggleActivo = async (p: Producto, value: boolean) => {
    setItems((prev) =>
      prev.map((x) => (x.id_producto === p.id_producto ? { ...x, activo: value } : x)),
    );
    try {
      await actualizarProducto({ id_producto: p.id_producto, activo: value });
    } catch (e) {
      toast.error("No se pudo actualizar", {
        description: e instanceof Error ? e.message : undefined,
      });
      load();
    }
  };

  const filtered = items.filter(
    (p) => !q.trim() || p.nombre_producto.toLowerCase().includes(q.trim().toLowerCase()),
  );

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar producto…"
          className="pl-9"
        />
      </div>

      {/* Desktop */}
      <div className="hidden md:block rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12"></TableHead>
              <TableHead>Producto</TableHead>
              <TableHead className="text-right">Precio</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-sm text-muted-foreground">
                  Cargando…
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-sm text-muted-foreground">
                  Sin productos. Crea una receta para generar uno.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((p) => (
                <TableRow key={p.id_producto}>
                  <TableCell>
                    {p.url_imagen ? (
                      <img
                        src={publicUrl(p.url_imagen) ?? undefined}
                        alt={p.nombre_producto}
                        className="h-10 w-10 rounded object-cover"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded bg-muted flex items-center justify-center text-muted-foreground">
                        <ImageIcon className="h-4 w-4" />
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="font-medium">{p.nombre_producto}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    ${Number(p.precio_venta).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Switch checked={p.activo} onCheckedChange={(v) => toggleActivo(p, v)} />
                      <Badge variant={p.activo ? "default" : "secondary"}>
                        {p.activo ? "Activo" : "Inactivo"}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" onClick={() => setSelected(p)}>
                      <Pencil className="h-3.5 w-3.5 mr-1" /> Editar
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Mobile */}
      <div className="md:hidden space-y-2">
        {loading ? (
          <p className="text-center text-sm text-muted-foreground py-8">Cargando…</p>
        ) : filtered.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-8">Sin productos.</p>
        ) : (
          filtered.map((p) => (
            <div
              key={p.id_producto}
              className="rounded-md border bg-card p-3 flex gap-3 animate-fade-in"
            >
              {p.url_imagen ? (
                <img
                  src={publicUrl(p.url_imagen) ?? undefined}
                  alt={p.nombre_producto}
                  className="h-16 w-16 rounded object-cover shrink-0"
                />
              ) : (
                <div className="h-16 w-16 rounded bg-muted flex items-center justify-center shrink-0">
                  <ImageIcon className="h-5 w-5 text-muted-foreground" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{p.nombre_producto}</p>
                <p className="text-sm text-muted-foreground tabular-nums">
                  ${Number(p.precio_venta).toLocaleString()}
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <Switch checked={p.activo} onCheckedChange={(v) => toggleActivo(p, v)} />
                  <Badge variant={p.activo ? "default" : "secondary"} className="text-xs">
                    {p.activo ? "Activo" : "Inactivo"}
                  </Badge>
                  <Button
                    size="sm"
                    variant="outline"
                    className="ml-auto"
                    onClick={() => setSelected(p)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <ResponsiveSheet
        open={!!selected}
        onOpenChange={(o) => !o && setSelected(null)}
        title="Editar producto"
        description="El nombre proviene de la receta y no se edita aquí."
        desktopWidthClass="sm:max-w-2xl"
      >
        {selected && (
          <ProductoForm
            key={selected.id_producto}
            idNegocio={idNegocio}
            producto={selected}
            onSuccess={() => {
              setSelected(null);
              load();
            }}
            onCancel={() => setSelected(null)}
          />
        )}
      </ResponsiveSheet>
    </div>
  );
}
