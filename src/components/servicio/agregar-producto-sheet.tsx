import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ImageIcon, Loader2, Plus, Search, X } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { getCatalogoServicio } from "@/lib/servicio.functions";
import { ItemEditorSheet } from "./item-editor-sheet";

const fmt = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

interface CatProducto {
  id_producto: string;
  nombre_producto: string;
  precio_venta: number;
  url_imagen: string | null;
  id_categoria: string;
}

function norm(s: string) {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

export function AgregarProductoSheet({
  open,
  onOpenChange,
  idPedido,
  titulo = "Agregar producto",
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  idPedido: string;
  titulo?: string;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["catalogoServicio"],
    queryFn: () => getCatalogoServicio(),
    enabled: open,
  });

  const [catActiva, setCatActiva] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [editing, setEditing] = useState<CatProducto | null>(null);

  const filtrados = useMemo(() => {
    if (!data) return [];
    const q = norm(busqueda.trim());
    return data.productos.filter((p) => {
      if (catActiva && p.id_categoria !== catActiva) return false;
      if (q && !norm(p.nombre_producto).includes(q)) return false;
      return true;
    });
  }, [data, catActiva, busqueda]);

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{titulo}</SheetTitle>
            <SheetDescription>Busca o filtra por categoría.</SheetDescription>
          </SheetHeader>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Buscar producto…"
                  className="pl-9 pr-9"
                />
                {busqueda && (
                  <button
                    type="button"
                    aria-label="Limpiar búsqueda"
                    onClick={() => setBusqueda("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-muted"
                  >
                    <X className="h-4 w-4 text-muted-foreground" />
                  </button>
                )}
              </div>

              {(data?.categorias.length ?? 0) > 0 && (
                <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                  <Pill active={catActiva === null} onClick={() => setCatActiva(null)}>
                    Todo
                  </Pill>
                  {data!.categorias.map((c) => (
                    <Pill
                      key={c.id_categoria}
                      active={catActiva === c.id_categoria}
                      onClick={() => setCatActiva(c.id_categoria)}
                    >
                      {c.nombre}
                    </Pill>
                  ))}
                </div>
              )}

              {filtrados.length === 0 ? (
                <div className="text-center py-10 border rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    {busqueda
                      ? `Sin productos para “${busqueda}”`
                      : "No hay productos en esta categoría"}
                  </p>
                  {(busqueda || catActiva) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-2"
                      onClick={() => {
                        setBusqueda("");
                        setCatActiva(null);
                      }}
                    >
                      Limpiar filtros
                    </Button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {filtrados.map((p) => (
                    <button
                      key={p.id_producto}
                      onClick={() => setEditing(p)}
                      className="text-left rounded-xl border bg-card p-3 hover:shadow-md transition-shadow"
                    >
                      <div className="flex gap-3 min-w-0">
                        <div className="h-14 w-14 shrink-0 rounded-lg bg-muted flex items-center justify-center overflow-hidden">
                          {p.url_imagen ? (
                            <img
                              src={p.url_imagen}
                              alt={p.nombre_producto}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <ImageIcon className="h-5 w-5 text-muted-foreground" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="font-semibold text-sm line-clamp-2 break-words">
                            {p.nombre_producto}
                          </h3>
                          <p className="text-sm font-bold mt-1 tabular-nums">
                            {fmt.format(p.precio_venta)}
                          </p>
                        </div>
                        <Plus className="h-4 w-4 text-muted-foreground self-center shrink-0" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>

      <ItemEditorSheet
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
        producto={editing}
        idPedido={idPedido}
      />
    </>
  );
}

function Pill({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm border transition-colors ${
        active
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-card border-border hover:bg-muted"
      }`}
    >
      {children}
    </button>
  );
}
