import { useCallback, useEffect, useRef, useState } from "react";
import { useEspacios } from "@/hooks/use-espacios";
import { ChevronLeft, ChevronRight, GripVertical, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ResponsiveSheet } from "@/components/ui/responsive-sheet";
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
import { cn } from "@/lib/utils";
import {
  categoriaSchema,
  type CategoriaInput,
  subcategoriaSchema,
  type SubcategoriaInput,
} from "@/lib/menu-schemas";

interface Categoria { id_categoria: string; nombre: string; destino: string; orden: number }
interface Subcategoria { id_subcategoria: string; nombre: string; id_categoria: string; orden: number }

export function CategoriasMasterDetail({ idNegocio }: { idNegocio: string }) {
  const [cats, setCats] = useState<Categoria[]>([]);
  const [subs, setSubs] = useState<Subcategoria[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [catSheet, setCatSheet] = useState<{ open: boolean; editing?: Categoria }>({ open: false });
  const [subSheet, setSubSheet] = useState<{ open: boolean; editing?: Subcategoria }>({ open: false });
  const [delCat, setDelCat] = useState<Categoria | null>(null);
  const [delSub, setDelSub] = useState<Subcategoria | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: cData }, { data: sData }] = await Promise.all([
      supabase.from("categorias").select("id_categoria, nombre, destino, orden").order("orden").order("nombre"),
      supabase.from("subcategorias").select("id_subcategoria, nombre, id_categoria, orden").order("orden").order("nombre"),
    ]);
    setCats((cData as Categoria[]) ?? []);
    setSubs((sData as Subcategoria[]) ?? []);
    setLoading(false);
  }, []);


  useEffect(() => { load(); }, [load]);

  const autoSelected = useRef(false);
  useEffect(() => {
    if (selected && !cats.find((c) => c.id_categoria === selected)) {
      setSelected(null);
      return;
    }
    // Auto-seleccionar la primera categoría solo en desktop y solo una vez al cargar
    if (!autoSelected.current && cats.length > 0 && typeof window !== "undefined") {
      autoSelected.current = true;
      if (window.matchMedia("(min-width: 768px)").matches && !selected) {
        setSelected(cats[0].id_categoria);
      }
    }
  }, [cats, selected]);

  const subsOf = selected ? subs.filter((s) => s.id_categoria === selected) : [];
  const selectedCat = cats.find((c) => c.id_categoria === selected);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const persistOrden = async (
    kind: "categorias" | "subcategorias",
    items: Array<{ id: string; orden: number }>,
  ) => {
    const results = await Promise.all(
      items.map((it) =>
        kind === "categorias"
          ? supabase.from("categorias").update({ orden: it.orden }).eq("id_categoria", it.id)
          : supabase.from("subcategorias").update({ orden: it.orden }).eq("id_subcategoria", it.id),
      ),
    );
    const err = results.find((r) => r.error)?.error;
    if (err) {
      toast.error("No se pudo guardar el orden", { description: err.message });
      load();
    }
  };


  const handleCatDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = cats.findIndex((c) => c.id_categoria === active.id);
    const newIdx = cats.findIndex((c) => c.id_categoria === over.id);
    if (oldIdx < 0 || newIdx < 0) return;
    const next = arrayMove(cats, oldIdx, newIdx).map((c, i) => ({ ...c, orden: i }));
    setCats(next);
    persistOrden(
      "categorias",
      next.map((c) => ({ id: c.id_categoria, orden: c.orden })),
    );

  };

  const handleSubDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id || !selected) return;
    const oldIdx = subsOf.findIndex((s) => s.id_subcategoria === active.id);
    const newIdx = subsOf.findIndex((s) => s.id_subcategoria === over.id);
    if (oldIdx < 0 || newIdx < 0) return;
    const nextSubsOf = arrayMove(subsOf, oldIdx, newIdx).map((s, i) => ({ ...s, orden: i }));
    setSubs((prev) => [
      ...prev.filter((s) => s.id_categoria !== selected),
      ...nextSubsOf,
    ]);
    persistOrden(
      "subcategorias",
      nextSubsOf.map((s) => ({ id: s.id_subcategoria, orden: s.orden })),
    );

  };

  return (
    <div className="grid gap-4 md:grid-cols-[280px_minmax(0,1fr)]">
      {/* Lista categorías */}
      <div className={cn("min-w-0 rounded-md border bg-card", selected && "hidden md:block")}>
        <div className="flex items-center justify-between p-3 border-b">
          <h3 className="text-sm font-semibold">Categorías</h3>
          <Button size="sm" variant="ghost" onClick={() => setCatSheet({ open: true })}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <div className="divide-y">
          {loading ? (
            <p className="p-4 text-sm text-muted-foreground">Cargando…</p>
          ) : cats.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">Aún no hay categorías.</p>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleCatDragEnd}>
              <SortableContext items={cats.map((c) => c.id_categoria)} strategy={verticalListSortingStrategy}>
                {cats.map((c) => (
                  <SortableCategoria
                    key={c.id_categoria}
                    cat={c}
                    selected={selected === c.id_categoria}
                    onSelect={() => setSelected(c.id_categoria)}
                  />
                ))}
              </SortableContext>
            </DndContext>
          )}
        </div>
      </div>

      {/* Detalle subcategorías */}
      <div className={cn("min-w-0 rounded-md border bg-card", !selected && "hidden md:block")}>
        <div className="flex items-center justify-between gap-2 border-b p-3">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 shrink-0 md:hidden"
              onClick={() => setSelected(null)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h3 className="min-w-0 truncate text-sm font-semibold">
              {selectedCat ? selectedCat.nombre : "Selecciona una categoría"}
            </h3>
          </div>
          {selectedCat && (
            <div className="flex shrink-0 items-center gap-0.5">
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setCatSheet({ open: true, editing: selectedCat })}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => setDelCat(selectedCat)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
              <Button size="icon" className="h-8 w-8" onClick={() => setSubSheet({ open: true })} aria-label="Agregar subcategoría">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
        <div className="divide-y">
          {!selectedCat ? (
            <p className="p-6 text-sm text-muted-foreground text-center">Selecciona una categoría para ver sus subcategorías.</p>
          ) : subsOf.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground text-center">Esta categoría aún no tiene subcategorías.</p>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleSubDragEnd}>
              <SortableContext items={subsOf.map((s) => s.id_subcategoria)} strategy={verticalListSortingStrategy}>
                {subsOf.map((s) => (
                  <SortableSubcategoria
                    key={s.id_subcategoria}
                    sub={s}
                    onEdit={() => setSubSheet({ open: true, editing: s })}
                    onDelete={() => setDelSub(s)}
                  />
                ))}
              </SortableContext>
            </DndContext>
          )}
        </div>
      </div>


      <ResponsiveSheet
        open={catSheet.open}
        onOpenChange={(o) => setCatSheet({ open: o, editing: o ? catSheet.editing : undefined })}
        title={catSheet.editing ? "Editar categoría" : "Nueva categoría"}
      >
        <CategoriaFormInline
          key={catSheet.editing?.id_categoria ?? "new"}
          idNegocio={idNegocio}
          initial={catSheet.editing}
          onDone={() => { setCatSheet({ open: false }); load(); }}
          onCancel={() => setCatSheet({ open: false })}
        />
      </ResponsiveSheet>

      <ResponsiveSheet
        open={subSheet.open}
        onOpenChange={(o) => setSubSheet({ open: o, editing: o ? subSheet.editing : undefined })}
        title={subSheet.editing ? "Editar subcategoría" : "Nueva subcategoría"}
      >
        {selected && (
          <SubcategoriaFormInline
            key={subSheet.editing?.id_subcategoria ?? "new"}
            idNegocio={idNegocio}
            idCategoria={selected}
            initial={subSheet.editing}
            onDone={() => { setSubSheet({ open: false }); load(); }}
            onCancel={() => setSubSheet({ open: false })}
          />
        )}
      </ResponsiveSheet>

      <AlertDialog open={!!delCat} onOpenChange={(o) => !o && setDelCat(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar categoría?</AlertDialogTitle>
            <AlertDialogDescription>
              No se podrá eliminar si tiene subcategorías o recetas asociadas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!delCat) return;
                const { error } = await supabase.from("categorias").delete().eq("id_categoria", delCat.id_categoria);
                if (error) toast.error("No se pudo eliminar", { description: error.message });
                else { toast.success("Categoría eliminada"); load(); }
                setDelCat(null);
              }}
            >Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!delSub} onOpenChange={(o) => !o && setDelSub(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar subcategoría?</AlertDialogTitle>
            <AlertDialogDescription>No se podrá eliminar si tiene recetas asociadas.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!delSub) return;
                const { error } = await supabase.from("subcategorias").delete().eq("id_subcategoria", delSub.id_subcategoria);
                if (error) toast.error("No se pudo eliminar", { description: error.message });
                else { toast.success("Subcategoría eliminada"); load(); }
                setDelSub(null);
              }}
            >Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function CategoriaFormInline({
  idNegocio, initial, onDone, onCancel,
}: { idNegocio: string; initial?: Categoria; onDone: () => void; onCancel: () => void }) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<CategoriaInput>({
    resolver: zodResolver(categoriaSchema),
    defaultValues: { nombre: initial?.nombre ?? "" },
  });
  const { espacios, loading: loadingEsp } = useEspacios({ soloActivos: true });
  const initialDestino = (initial?.destino as string | undefined)?.toUpperCase();
  const [destino, setDestino] = useState<string>(initialDestino ?? "COCINA");
  useEffect(() => {
    if (!loadingEsp && espacios.length > 0 && !espacios.find((e) => e.slug === destino)) {
      setDestino(espacios[0].slug);
    }
  }, [loadingEsp, espacios, destino]);
  const [confirmMove, setConfirmMove] = useState<null | { nombreEspacio: string }>(null);

  const doSave = async (v: CategoriaInput) => {
    if (initial) {
      const nombreChanged = v.nombre !== initial.nombre;
      const destinoChanged = destino !== (initial.destino ?? "").toUpperCase();
      if (nombreChanged) {
        const { error } = await supabase.from("categorias").update({ nombre: v.nombre }).eq("id_categoria", initial.id_categoria);
        if (error) return toast.error("No se pudo actualizar", { description: error.message });
      }
      if (destinoChanged) {
        const { data, error } = await supabase.rpc("set_categoria_destino", {
          p_id_categoria: initial.id_categoria,
          p_destino: destino,
        });
        if (error) return toast.error("No se pudo mover la categoría", { description: error.message });
        const updated = (data as { updated_items?: number } | null)?.updated_items ?? 0;
        toast.success("Categoría movida", {
          description: updated > 0 ? `Se actualizaron ${updated} pedido(s) pendiente(s).` : undefined,
        });
      } else if (nombreChanged) {
        toast.success("Categoría actualizada");
      } else {
        toast.info("Sin cambios");
      }
    } else {
      const { data: maxRow } = await supabase.from("categorias").select("orden").eq("id_negocio", idNegocio).order("orden", { ascending: false }).limit(1).maybeSingle();
      const nextOrden = (maxRow?.orden ?? -1) + 1;
      const { error } = await supabase.from("categorias").insert({ id_negocio: idNegocio, nombre: v.nombre, destino, orden: nextOrden });
      if (error) return toast.error("No se pudo crear", { description: error.message });
      toast.success("Categoría creada");
    }
    onDone();
  };

  return (
    <>
    <form onSubmit={handleSubmit(async (v) => {
      const destinoChanged = !!initial && destino !== (initial.destino ?? "").toUpperCase();
      if (destinoChanged) {
        const esp = espacios.find((e) => e.slug === destino);
        setConfirmMove({ nombreEspacio: esp?.nombre ?? destino });
        // guardar pendiente hasta confirmar
        (window as unknown as { __pendingCatSave?: () => void }).__pendingCatSave = () => doSave(v);
        return;
      }
      await doSave(v);
    })} className="space-y-4">

      <div className="space-y-1.5">
        <Label htmlFor="nombre">Nombre</Label>
        <Input id="nombre" {...register("nombre")} placeholder="Ej. Bebidas" autoFocus />
        {errors.nombre && <p className="text-xs text-destructive">{errors.nombre.message}</p>}
      </div>
      <div className="space-y-1.5">
        <Label>Espacio de trabajo (ruteo de comandas)</Label>
        {loadingEsp ? (
          <p className="text-sm text-muted-foreground">Cargando espacios…</p>
        ) : espacios.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay espacios activos.</p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {espacios.map((esp) => (
              <button
                key={esp.id_espacio}
                type="button"
                onClick={() => setDestino(esp.slug)}
                className={cn(
                  "rounded-md border px-3 py-2 text-sm transition-colors text-left",
                  destino === esp.slug ? "border-primary bg-primary/10 font-medium" : "hover:bg-muted",
                )}
              >
                {esp.slug === "COCINA" ? "🍳 " : esp.slug === "BARRA" ? "🍷 " : "🍽️ "}
                {esp.nombre}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="flex gap-2">
        <Button type="button" variant="outline" className="flex-1" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" className="flex-1" disabled={isSubmitting}>{isSubmitting ? "Guardando…" : "Guardar"}</Button>
      </div>
    </form>
  );
}

function SubcategoriaFormInline({
  idNegocio, idCategoria, initial, onDone, onCancel,
}: { idNegocio: string; idCategoria: string; initial?: Subcategoria; onDone: () => void; onCancel: () => void }) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<SubcategoriaInput>({
    resolver: zodResolver(subcategoriaSchema),
    defaultValues: { nombre: initial?.nombre ?? "", id_categoria: idCategoria },
  });
  return (
    <form onSubmit={handleSubmit(async (v) => {
      if (initial) {
        const { error } = await supabase.from("subcategorias").update({ nombre: v.nombre }).eq("id_subcategoria", initial.id_subcategoria);
        if (error) return toast.error("No se pudo actualizar", { description: error.message });
        toast.success("Subcategoría actualizada");
      } else {
        const { data: maxRow } = await supabase.from("subcategorias").select("orden").eq("id_categoria", idCategoria).order("orden", { ascending: false }).limit(1).maybeSingle();
        const nextOrden = (maxRow?.orden ?? -1) + 1;
        const { error } = await supabase.from("subcategorias").insert({
          id_negocio: idNegocio, id_categoria: idCategoria, nombre: v.nombre, orden: nextOrden,
        });

        if (error) return toast.error("No se pudo crear", { description: error.message });
        toast.success("Subcategoría creada");
      }
      onDone();
    })} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="snombre">Nombre</Label>
        <Input id="snombre" {...register("nombre")} placeholder="Ej. Frías" autoFocus />
        {errors.nombre && <p className="text-xs text-destructive">{errors.nombre.message}</p>}
      </div>
      <div className="flex gap-2">
        <Button type="button" variant="outline" className="flex-1" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" className="flex-1" disabled={isSubmitting}>{isSubmitting ? "Guardando…" : "Guardar"}</Button>
      </div>
    </form>
  );
}

function SortableCategoria({
  cat, selected, onSelect,
}: { cat: Categoria; selected: boolean; onSelect: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: cat.id_categoria });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex w-full items-center gap-1 pl-1 pr-3 py-2.5 text-left text-sm hover:bg-muted transition-colors",
        selected && "bg-muted font-medium",
      )}
    >
      <button
        type="button"
        className="touch-none cursor-grab active:cursor-grabbing p-1 text-muted-foreground hover:text-foreground"
        aria-label="Arrastrar para reordenar"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={onSelect}
        className="flex min-w-0 flex-1 items-center justify-between text-left"
      >
        <span className="truncate">{cat.nombre}</span>
        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
      </button>
    </div>
  );
}

function SortableSubcategoria({
  sub, onEdit, onDelete,
}: { sub: Subcategoria; onEdit: () => void; onDelete: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: sub.id_subcategoria });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-1 pl-1 pr-3 py-2.5">
      <button
        type="button"
        className="touch-none cursor-grab active:cursor-grabbing p-1 text-muted-foreground hover:text-foreground"
        aria-label="Arrastrar para reordenar"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <span className="flex-1 text-sm truncate">{sub.nombre}</span>
      <div className="flex items-center gap-1">
        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onEdit}>
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={onDelete}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
