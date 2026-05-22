import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Info, Minus, Plus, Search, ShoppingBasket, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { IngredienteInput } from "@/lib/menu-schemas";

interface Cat { id_categoria: string; nombre: string }
interface Sub { id_subcategoria: string; nombre: string; id_categoria: string }
interface Insumo { id_insumo: string; nombre_insumo: string; unidad_receta: string }

interface Props {
  idNegocio: string;
  mode: "create" | "edit";
  idReceta?: string;
}

export function RecetaBuilder({ mode, idReceta }: Props) {
  const navigate = useNavigate();
  const [cats, setCats] = useState<Cat[]>([]);
  const [subs, setSubs] = useState<Sub[]>([]);
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [idCategoria, setIdCategoria] = useState("");
  const [idSubcategoria, setIdSubcategoria] = useState("");
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [ingredientes, setIngredientes] = useState<IngredienteInput[]>([]);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: c }, { data: s }, { data: i }] = await Promise.all([
      supabase.from("categorias").select("id_categoria, nombre").order("nombre"),
      supabase.from("subcategorias").select("id_subcategoria, nombre, id_categoria").order("nombre"),
      supabase.from("insumos").select("id_insumo, nombre_insumo, unidad_receta").order("nombre_insumo"),
    ]);
    setCats((c as Cat[]) ?? []);
    setSubs((s as Sub[]) ?? []);
    setInsumos((i as Insumo[]) ?? []);

    if (mode === "edit" && idReceta) {
      const { data: r } = await supabase
        .from("receta_master")
        .select("nombre_receta, descripcion, id_categoria, id_subcategoria")
        .eq("id_receta", idReceta)
        .maybeSingle();
      const { data: d } = await supabase
        .from("receta_detalle")
        .select("cantidad, insumos(id_insumo, nombre_insumo, unidad_receta)")
        .eq("id_receta", idReceta);
      if (r) {
        setNombre(r.nombre_receta);
        setDescripcion(r.descripcion ?? "");
        setIdCategoria(r.id_categoria);
        setIdSubcategoria(r.id_subcategoria);
      }
      if (d) {
        setIngredientes(
          (d as unknown as { cantidad: number; insumos: Insumo }[]).map((x) => ({
            id_insumo: x.insumos.id_insumo,
            nombre_insumo: x.insumos.nombre_insumo,
            unidad_receta: x.insumos.unidad_receta,
            cantidad: Number(x.cantidad),
          }))
        );
      }
    }
    setLoading(false);
  }, [mode, idReceta]);

  useEffect(() => { load(); }, [load]);

  const subsFiltradas = useMemo(
    () => subs.filter((s) => s.id_categoria === idCategoria),
    [subs, idCategoria]
  );

  const insumosDisponibles = useMemo(() => {
    const ya = new Set(ingredientes.map((x) => x.id_insumo));
    const term = search.trim().toLowerCase();
    return insumos
      .filter((i) => !ya.has(i.id_insumo))
      .filter((i) => !term || i.nombre_insumo.toLowerCase().includes(term))
      .slice(0, 8);
  }, [insumos, ingredientes, search]);

  const agregar = (i: Insumo) => {
    setIngredientes((prev) => [
      ...prev,
      { id_insumo: i.id_insumo, nombre_insumo: i.nombre_insumo, unidad_receta: i.unidad_receta, cantidad: 1 },
    ]);
    setSearch("");
  };

  const quitar = (id: string) => setIngredientes((prev) => prev.filter((x) => x.id_insumo !== id));

  const setCantidad = (id: string, val: number) =>
    setIngredientes((prev) => prev.map((x) => x.id_insumo === id ? { ...x, cantidad: val } : x));

  const stepCantidad = (id: string, delta: number) =>
    setIngredientes((prev) => prev.map((x) =>
      x.id_insumo === id ? { ...x, cantidad: Math.max(0.01, Number((x.cantidad + delta).toFixed(2))) } : x
    ));

  const handleCategoria = (v: string) => {
    setIdCategoria(v);
    setIdSubcategoria("");
  };

  const puedeGuardar = idCategoria && idSubcategoria && nombre.trim() && ingredientes.length > 0 && ingredientes.every((x) => x.cantidad > 0);

  const guardar = async () => {
    if (!puedeGuardar) {
      toast.error("Completa todos los campos y agrega ingredientes");
      return;
    }
    setSaving(true);
    const payload = ingredientes.map((x) => ({ id_insumo: x.id_insumo, cantidad: x.cantidad }));
    try {
      if (mode === "create") {
        const { error } = await supabase.rpc("crear_receta", {
          p_id_categoria: idCategoria,
          p_id_subcategoria: idSubcategoria,
          p_nombre: nombre,
          p_descripcion: descripcion,
          p_ingredientes: payload,
        });
        if (error) throw error;
        toast.success("Receta creada", { description: "Se creó también el producto asociado." });
        navigate({ to: "/menu/productos" });
      } else if (idReceta) {
        const { error } = await supabase.rpc("actualizar_receta", {
          p_id_receta: idReceta,
          p_id_categoria: idCategoria,
          p_id_subcategoria: idSubcategoria,
          p_nombre: nombre,
          p_descripcion: descripcion,
          p_ingredientes: payload,
        });
        if (error) throw error;
        toast.success("Receta actualizada");
        navigate({ to: "/menu/recetas" });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error desconocido";
      toast.error("No se pudo guardar", { description: msg });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="text-sm text-muted-foreground">Cargando…</p>;

  return (
    <TooltipProvider>
      <div className="space-y-6 max-w-5xl mx-auto pb-32">
        <header className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="icon">
              <Link to="/menu/recetas"><ArrowLeft className="h-4 w-4" /></Link>
            </Button>
            <h1 className="text-2xl font-bold">
              {mode === "create" ? "Nueva receta" : "Editar receta"}
            </h1>
          </div>
        </header>

        <section className="rounded-lg border bg-card p-4 space-y-4 animate-fade-in">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">1</span>
            <h2 className="text-base font-semibold">Clasifica la receta</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Categoría</Label>
              <Select value={idCategoria} onValueChange={handleCategoria}>
                <SelectTrigger><SelectValue placeholder="Selecciona…" /></SelectTrigger>
                <SelectContent>
                  {cats.length === 0 ? (
                    <div className="p-3 text-sm text-muted-foreground">
                      Aún no hay categorías. <Link to="/menu/categorias" className="underline">Crear</Link>
                    </div>
                  ) : cats.map((c) => (
                    <SelectItem key={c.id_categoria} value={c.id_categoria}>{c.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Subcategoría</Label>
              <Select value={idSubcategoria} onValueChange={setIdSubcategoria} disabled={!idCategoria}>
                <SelectTrigger><SelectValue placeholder={idCategoria ? "Selecciona…" : "Primero elige categoría"} /></SelectTrigger>
                <SelectContent>
                  {subsFiltradas.length === 0 && idCategoria ? (
                    <div className="p-3 text-sm text-muted-foreground">
                      Sin subcategorías. <Link to="/menu/categorias" className="underline">Agregar</Link>
                    </div>
                  ) : subsFiltradas.map((s) => (
                    <SelectItem key={s.id_subcategoria} value={s.id_subcategoria}>{s.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </section>

        <section className={cn("rounded-lg border bg-card p-4 space-y-4 transition-opacity animate-fade-in", !idSubcategoria && "opacity-50 pointer-events-none")}>
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">2</span>
            <h2 className="text-base font-semibold">Nombre y descripción</h2>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Label htmlFor="nombre">Nombre de la receta</Label>
              <Tooltip defaultOpen>
                <TooltipTrigger asChild>
                  <button type="button" className="text-muted-foreground hover:text-foreground">
                    <Info className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-xs">
                  El nombre de esta receta será el mismo nombre del producto final.
                </TooltipContent>
              </Tooltip>
            </div>
            <Input id="nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. Limonada de coco" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="desc">Descripción (opcional)</Label>
            <Textarea id="desc" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} rows={2} placeholder="Notas internas sobre la preparación" />
          </div>
        </section>

        <section className={cn("rounded-lg border bg-card p-4 space-y-4 animate-fade-in", !nombre.trim() && "opacity-50 pointer-events-none")}>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">3</span>
              <h2 className="text-base font-semibold">Agrega ingredientes</h2>
            </div>
            <Badge variant="secondary" className="gap-1">
              <ShoppingBasket className="h-3 w-3" /> {ingredientes.length}
            </Badge>
          </div>

          <div className="relative">
            <Search className="h-5 w-5 absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar insumo… (ej. carne, queso, leche)"
              className="pl-12 h-14 text-base"
            />
          </div>

          {search.trim() && insumosDisponibles.length > 0 && (
            <div className="grid gap-2 sm:grid-cols-2 animate-fade-in">
              {insumosDisponibles.map((i) => (
                <button
                  key={i.id_insumo}
                  type="button"
                  onClick={() => agregar(i)}
                  className="flex items-center justify-between rounded-md border bg-background px-3 py-2.5 text-left hover-scale hover:border-primary transition-colors"
                >
                  <div>
                    <p className="font-medium text-sm">{i.nombre_insumo}</p>
                    <p className="text-xs text-muted-foreground">en {i.unidad_receta}</p>
                  </div>
                  <Plus className="h-4 w-4 text-primary" />
                </button>
              ))}
            </div>
          )}
          {search.trim() && insumosDisponibles.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">Sin coincidencias.</p>
          )}

          <div className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground">
              {ingredientes.length === 0 ? "Tu lista de ingredientes está vacía" : `${ingredientes.length} ingrediente${ingredientes.length === 1 ? "" : "s"}`}
            </h3>
            {ingredientes.map((ing) => (
              <div key={ing.id_insumo} className="flex items-center gap-2 rounded-md border bg-background p-3 animate-scale-in">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{ing.nombre_insumo}</p>
                  <p className="text-xs text-muted-foreground">{ing.unidad_receta}</p>
                </div>
                <div className="flex items-center gap-1">
                  <Button type="button" size="icon" variant="outline" className="h-8 w-8" onClick={() => stepCantidad(ing.id_insumo, -1)}>
                    <Minus className="h-3.5 w-3.5" />
                  </Button>
                  <Input
                    type="number"
                    step="any"
                    min={0.01}
                    value={ing.cantidad}
                    onChange={(e) => setCantidad(ing.id_insumo, Number(e.target.value) || 0)}
                    className="h-8 w-20 text-center tabular-nums"
                  />
                  <Button type="button" size="icon" variant="outline" className="h-8 w-8" onClick={() => stepCantidad(ing.id_insumo, 1)}>
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => quitar(ing.id_insumo)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </section>

        <div className="fixed bottom-0 left-0 right-0 border-t bg-background/95 backdrop-blur p-3 z-30">
          <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground hidden sm:block">
              {ingredientes.length > 0 ? `${ingredientes.length} ingrediente${ingredientes.length === 1 ? "" : "s"} listo${ingredientes.length === 1 ? "" : "s"}` : "Agrega ingredientes para continuar"}
            </p>
            <div className="flex gap-2 w-full sm:w-auto">
              <Button variant="outline" className="flex-1 sm:flex-none" asChild>
                <Link to="/menu/recetas">Cancelar</Link>
              </Button>
              <Button onClick={guardar} disabled={!puedeGuardar || saving} className="flex-1 sm:flex-none">
                {saving ? "Guardando…" : mode === "create" ? "Crear receta" : "Guardar cambios"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
