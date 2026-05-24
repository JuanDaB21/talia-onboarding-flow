import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ResponsiveSheet } from "@/components/bodega/responsive-sheet";
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

interface Categoria { id_categoria: string; nombre: string; destino: string }
interface Subcategoria { id_subcategoria: string; nombre: string; id_categoria: string }

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
      supabase.from("categorias").select("id_categoria, nombre, destino").order("nombre"),
      supabase.from("subcategorias").select("id_subcategoria, nombre, id_categoria").order("nombre"),
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
            cats.map((c) => (
              <button
                key={c.id_categoria}
                onClick={() => setSelected(c.id_categoria)}
                className={cn(
                  "flex w-full items-center justify-between px-3 py-2.5 text-left text-sm hover:bg-muted transition-colors",
                  selected === c.id_categoria && "bg-muted font-medium"
                )}
              >
                <span className="truncate">{c.nombre}</span>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </button>
            ))
          )}
        </div>
      </div>

      {/* Detalle subcategorías */}
      <div className={cn("rounded-md border bg-card", !selected && "hidden md:block")}>
        <div className="flex items-center justify-between p-3 border-b gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Button
              size="icon"
              variant="ghost"
              className="md:hidden h-8 w-8"
              onClick={() => setSelected(null)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h3 className="text-sm font-semibold truncate">
              {selectedCat ? `Subcategorías de "${selectedCat.nombre}"` : "Selecciona una categoría"}
            </h3>
          </div>
          {selectedCat && (
            <div className="flex items-center gap-1 shrink-0">
              <Button size="sm" variant="ghost" onClick={() => setCatSheet({ open: true, editing: selectedCat })}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setDelCat(selectedCat)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
              <Button size="sm" onClick={() => setSubSheet({ open: true })}>
                <Plus className="h-4 w-4 mr-1" /> Sub.
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
            subsOf.map((s) => (
              <div key={s.id_subcategoria} className="flex items-center justify-between px-3 py-2.5">
                <span className="text-sm truncate">{s.nombre}</span>
                <div className="flex items-center gap-1">
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setSubSheet({ open: true, editing: s })}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => setDelSub(s)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))
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
  const [destino, setDestino] = useState<"COCINA" | "BARRA">(
    (initial?.destino as "COCINA" | "BARRA") ?? "COCINA",
  );
  return (
    <form onSubmit={handleSubmit(async (v) => {
      if (initial) {
        const { error } = await supabase.from("categorias").update({ nombre: v.nombre, destino }).eq("id_categoria", initial.id_categoria);
        if (error) return toast.error("No se pudo actualizar", { description: error.message });
        toast.success("Categoría actualizada");
      } else {
        const { error } = await supabase.from("categorias").insert({ id_negocio: idNegocio, nombre: v.nombre, destino });
        if (error) return toast.error("No se pudo crear", { description: error.message });
        toast.success("Categoría creada");
      }
      onDone();
    })} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="nombre">Nombre</Label>
        <Input id="nombre" {...register("nombre")} placeholder="Ej. Bebidas" autoFocus />
        {errors.nombre && <p className="text-xs text-destructive">{errors.nombre.message}</p>}
      </div>
      <div className="space-y-1.5">
        <Label>Destino (ruteo de comandas)</Label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setDestino("COCINA")}
            className={cn(
              "rounded-md border px-3 py-2 text-sm transition-colors",
              destino === "COCINA" ? "border-primary bg-primary/10 font-medium" : "hover:bg-muted",
            )}
          >🍳 Cocina</button>
          <button
            type="button"
            onClick={() => setDestino("BARRA")}
            className={cn(
              "rounded-md border px-3 py-2 text-sm transition-colors",
              destino === "BARRA" ? "border-primary bg-primary/10 font-medium" : "hover:bg-muted",
            )}
          >🍷 Barra</button>
        </div>
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
        const { error } = await supabase.from("subcategorias").insert({
          id_negocio: idNegocio, id_categoria: idCategoria, nombre: v.nombre,
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
