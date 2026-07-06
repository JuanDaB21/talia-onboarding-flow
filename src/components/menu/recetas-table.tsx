import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Copy, Pencil, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  type RecetaConNombres,
  duplicarReceta,
  eliminarReceta,
  listarRecetasConNombres,
} from "@/lib/menu.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type RecetaRow = RecetaConNombres;

export function RecetasTable() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<RecetaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [toDelete, setToDelete] = useState<RecetaRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listarRecetasConNombres();
      setRows(data ?? []);
    } catch (e) {
      toast.error("Error al cargar", { description: e instanceof Error ? e.message : undefined });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = rows.filter(
    (r) => !q.trim() || r.nombre_receta.toLowerCase().includes(q.trim().toLowerCase()),
  );

  const duplicar = async (id: string) => {
    try {
      await duplicarReceta({ id_receta: id });
      toast.success("Receta duplicada");
      load();
    } catch (e) {
      toast.error("No se pudo duplicar", {
        description: e instanceof Error ? e.message : undefined,
      });
    }
  };

  const eliminar = async () => {
    if (!toDelete) return;
    try {
      await eliminarReceta({ id_receta: toDelete.id_receta });
      toast.success("Receta eliminada");
    } catch (e) {
      toast.error("No se pudo eliminar", {
        description: e instanceof Error ? e.message : undefined,
      });
    }
    setToDelete(null);
    load();
  };

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar receta…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Desktop table */}
      <div className="hidden md:block rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Receta</TableHead>
              <TableHead>Categoría</TableHead>
              <TableHead>Subcategoría</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8 text-sm text-muted-foreground">
                  Cargando…
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8 text-sm text-muted-foreground">
                  Sin recetas. Crea la primera.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((r) => (
                <TableRow
                  key={r.id_receta}
                  className="cursor-pointer"
                  onClick={() => navigate({ to: "/menu/recetas/$id", params: { id: r.id_receta } })}
                >
                  <TableCell className="font-medium">{r.nombre_receta}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{r.categorias?.nombre ?? "—"}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{r.subcategorias?.nombre ?? "—"}</Badge>
                  </TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <Button size="icon" variant="ghost" className="h-8 w-8" asChild>
                      <Link to="/menu/recetas/$id" params={{ id: r.id_receta }}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Link>
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={() => duplicar(r.id_receta)}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-destructive"
                      onClick={() => setToDelete(r)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-2">
        {loading ? (
          <p className="text-center text-sm text-muted-foreground py-8">Cargando…</p>
        ) : filtered.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-8">Sin recetas.</p>
        ) : (
          filtered.map((r) => (
            <div key={r.id_receta} className="rounded-md border bg-card p-3 animate-fade-in">
              <Link to="/menu/recetas/$id" params={{ id: r.id_receta }} className="block">
                <p className="font-medium">{r.nombre_receta}</p>
                <div className="flex gap-1.5 mt-1">
                  <Badge variant="secondary" className="text-xs">
                    {r.categorias?.nombre ?? "—"}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {r.subcategorias?.nombre ?? "—"}
                  </Badge>
                </div>
              </Link>
              <div className="flex gap-2 mt-3 pt-3 border-t">
                <Button size="sm" variant="outline" className="flex-1" asChild>
                  <Link to="/menu/recetas/$id" params={{ id: r.id_receta }}>
                    <Pencil className="h-3.5 w-3.5 mr-1" /> Editar
                  </Link>
                </Button>
                <Button size="sm" variant="outline" onClick={() => duplicar(r.id_receta)}>
                  <Copy className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-destructive"
                  onClick={() => setToDelete(r)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar receta?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará también el producto asociado y todos los extras configurados. Esta acción
              no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={eliminar}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
