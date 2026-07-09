import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Info, Minus, Plus, Search, ShoppingBasket, X } from "lucide-react";
import { toast } from "sonner";
import {
  actualizarReceta,
  crearReceta,
  getRecetaDetalle,
  guardarExtras,
  listarCategorias,
  listarInsumos,
  listarSubcategorias,
} from "@/lib/menu.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { IngredienteInput } from "@/lib/menu-schemas";
import { VariantesBuilder } from "./variantes-builder";

interface Cat {
  id_categoria: string;
  nombre: string;
}
interface Sub {
  id_subcategoria: string;
  nombre: string;
  id_categoria: string;
}
interface Insumo {
  id_insumo: string;
  nombre_insumo: string;
  unidad_receta: string;
}
interface ExtraState {
  id_insumo_extra: string;
  cantidad_porcion: number;
  precio_extra: number;
}

// Acepta números decimales ("0.5", "0,5") y fracciones ("1/2", "1 1/2", "3/4").
// Devuelve null si el texto no es válido o resulta en <= 0.
function parseCantidadTexto(raw: string): number | null {
  const s = raw.trim().replace(",", ".");
  if (!s) return null;
  // "N M/D" (mixto) o "M/D" (fracción)
  const mixto = /^(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)$/.exec(s);
  if (mixto) {
    const [, ent, num, den] = mixto;
    const d = Number(den);
    if (d === 0) return null;
    const val = Number(ent) + Number(num) / d;
    return val > 0 ? val : null;
  }
  const frac = /^(\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)$/.exec(s);
  if (frac) {
    const [, num, den] = frac;
    const d = Number(den);
    if (d === 0) return null;
    const val = Number(num) / d;
    return val > 0 ? val : null;
  }
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function formatCantidadDisplay(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "";
  // hasta 3 decimales, sin ceros colgando
  return Number(n.toFixed(3)).toString();
}

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
  const [tiempoPrep, setTiempoPrep] = useState<string>("15");
  const [ingredientes, setIngredientes] = useState<IngredienteInput[]>([]);
  const [search, setSearch] = useState("");

  // Paso 4: Extras
  const [idProducto, setIdProducto] = useState<string | null>(null);
  const [extras, setExtras] = useState<Record<string, ExtraState>>({});
  const [extrasSearch, setExtrasSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [c, s, i] = await Promise.all([
        listarCategorias(),
        listarSubcategorias(),
        listarInsumos(),
      ]);
      setCats((c ?? []).map((x) => ({ id_categoria: x.id_categoria, nombre: x.nombre })));
      setSubs(
        (s ?? []).map((x) => ({
          id_subcategoria: x.id_subcategoria,
          nombre: x.nombre,
          id_categoria: x.id_categoria,
        })),
      );
      setInsumos(
        (i ?? []).map((x) => ({
          id_insumo: x.id_insumo,
          nombre_insumo: x.nombre_insumo,
          unidad_receta: x.unidad_receta,
        })),
      );

      if (mode === "edit" && idReceta) {
        const {
          receta: r,
          ingredientes: d,
          id_producto,
          extras: ex,
        } = await getRecetaDetalle(idReceta);
        if (r) {
          setNombre(r.nombre_receta);
          setDescripcion(r.descripcion ?? "");
          setIdCategoria(r.id_categoria);
          setIdSubcategoria(r.id_subcategoria);
          setTiempoPrep(String(r.tiempo_preparacion_min ?? 15));
        }
        setIngredientes(
          (d ?? []).map((x) => ({
            id_insumo: x.id_insumo,
            nombre_insumo: x.nombre_insumo,
            unidad_receta: x.unidad_receta,
            cantidad: Number(x.cantidad),
          })),
        );
        if (id_producto) {
          setIdProducto(id_producto);
          const map: Record<string, ExtraState> = {};
          (ex ?? []).forEach((e) => {
            map[e.id_insumo_extra] = {
              id_insumo_extra: e.id_insumo_extra,
              cantidad_porcion: Number(e.cantidad_porcion),
              precio_extra: Number(e.precio_extra),
            };
          });
          setExtras(map);
        }
      }
    } catch (e) {
      toast.error("No se pudo cargar la receta", {
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setLoading(false);
    }
  }, [mode, idReceta]);

  useEffect(() => {
    load();
  }, [load]);

  const subsFiltradas = useMemo(
    () => subs.filter((s) => s.id_categoria === idCategoria),
    [subs, idCategoria],
  );

  const insumosDisponibles = useMemo(() => {
    const ya = new Set(ingredientes.map((x) => x.id_insumo));
    const term = search.trim().toLowerCase();
    return insumos
      .filter((i) => !ya.has(i.id_insumo))
      .filter((i) => !term || i.nombre_insumo.toLowerCase().includes(term))
      .slice(0, 8);
  }, [insumos, ingredientes, search]);

  const insumosExtrasFiltrados = useMemo(() => {
    const term = extrasSearch.trim().toLowerCase();
    return insumos.filter((i) => !term || i.nombre_insumo.toLowerCase().includes(term));
  }, [insumos, extrasSearch]);

  const agregar = (i: Insumo) => {
    setIngredientes((prev) => [
      ...prev,
      {
        id_insumo: i.id_insumo,
        nombre_insumo: i.nombre_insumo,
        unidad_receta: i.unidad_receta,
        cantidad: 1,
      },
    ]);
    setSearch("");
  };

  const quitar = (id: string) => setIngredientes((prev) => prev.filter((x) => x.id_insumo !== id));

  const setCantidad = (id: string, val: number) =>
    setIngredientes((prev) => prev.map((x) => (x.id_insumo === id ? { ...x, cantidad: val } : x)));

  const stepCantidad = (id: string, delta: number) =>
    setIngredientes((prev) =>
      prev.map((x) =>
        x.id_insumo === id
          ? { ...x, cantidad: Math.max(0.01, Number((x.cantidad + delta).toFixed(3))) }
          : x,
      ),
    );

  const toggleExtra = (i: Insumo, checked: boolean) => {
    setExtras((prev) => {
      const next = { ...prev };
      if (checked)
        next[i.id_insumo] = { id_insumo_extra: i.id_insumo, cantidad_porcion: 1, precio_extra: 0 };
      else delete next[i.id_insumo];
      return next;
    });
  };

  const setExtraField = (id: string, field: "cantidad_porcion" | "precio_extra", val: number) => {
    setExtras((prev) => ({ ...prev, [id]: { ...prev[id], [field]: val } }));
  };

  const handleCategoria = (v: string) => {
    setIdCategoria(v);
    setIdSubcategoria("");
  };

  const tiempoPrepNum = Math.floor(Number(tiempoPrep) || 0);
  const puedeGuardar =
    idCategoria &&
    idSubcategoria &&
    nombre.trim() &&
    tiempoPrepNum > 0 &&
    ingredientes.length > 0 &&
    ingredientes.every((x) => x.cantidad > 0);

  const guardar = async () => {
    if (!puedeGuardar) {
      toast.error("Completa todos los campos y agrega ingredientes");
      return;
    }
    // Validar extras
    const listaExtras = Object.values(extras);
    for (const e of listaExtras) {
      if (e.cantidad_porcion <= 0) return toast.error("Hay extras con cantidad inválida");
      if (e.precio_extra < 0) return toast.error("Hay extras con precio inválido");
    }

    setSaving(true);
    const payload = ingredientes.map((x) => ({ id_insumo: x.id_insumo, cantidad: x.cantidad }));
    const recetaInput = {
      idCategoria,
      idSubcategoria,
      nombre,
      descripcion,
      ingredientes: payload,
      tiempoPreparacionMin: tiempoPrepNum,
    };
    try {
      let productoId = idProducto;
      let recetaIdFinal: string | null = idReceta ?? null;

      if (mode === "create") {
        const { idReceta: newRecetaId } = await crearReceta(recetaInput);
        recetaIdFinal = newRecetaId;
        // El detalle nuevo trae el id_producto recién creado (1:1 receta↔producto).
        const detalle = await getRecetaDetalle(newRecetaId);
        productoId = detalle.id_producto;
      } else if (idReceta) {
        await actualizarReceta(idReceta, recetaInput);
      }

      // Guardar extras (siempre, también vacío para limpiar)
      if (productoId) {
        try {
          await guardarExtras({ id_producto: productoId, extras: listaExtras });
        } catch (eErr) {
          toast.error("Receta guardada, pero los extras fallaron", {
            description: eErr instanceof Error ? eErr.message : undefined,
          });
        }
      }

      if (mode === "create" && recetaIdFinal) {
        toast.success("Receta creada", {
          description: "Ahora puedes configurar las variantes en el paso 5.",
        });
        navigate({ to: "/menu/recetas/$id", params: { id: recetaIdFinal } });
      } else if (productoId) {
        // Al terminar de configurar la receta, ir directo al producto para seguir
        // configurándolo (precio, imagen, disponibilidad).
        toast.success("Receta actualizada", {
          description: "Continúa configurando el producto.",
        });
        navigate({ to: "/menu/productos", search: { editar: productoId } });
      } else {
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
              <Link to="/menu/recetas">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <h1 className="text-2xl font-bold">
              {mode === "create" ? "Nueva receta" : "Editar receta"}
            </h1>
          </div>
        </header>

        <section className="rounded-lg border bg-card p-4 space-y-4 animate-fade-in">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
              1
            </span>
            <h2 className="text-base font-semibold">Clasifica la receta</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Categoría</Label>
              <Select value={idCategoria} onValueChange={handleCategoria}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona…" />
                </SelectTrigger>
                <SelectContent>
                  {cats.length === 0 ? (
                    <div className="p-3 text-sm text-muted-foreground">
                      Aún no hay categorías.{" "}
                      <Link to="/menu/categorias" className="underline">
                        Crear
                      </Link>
                    </div>
                  ) : (
                    cats.map((c) => (
                      <SelectItem key={c.id_categoria} value={c.id_categoria}>
                        {c.nombre}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Subcategoría</Label>
              <Select
                value={idSubcategoria}
                onValueChange={setIdSubcategoria}
                disabled={!idCategoria}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={idCategoria ? "Selecciona…" : "Primero elige categoría"}
                  />
                </SelectTrigger>
                <SelectContent>
                  {subsFiltradas.length === 0 && idCategoria ? (
                    <div className="p-3 text-sm text-muted-foreground">
                      Sin subcategorías.{" "}
                      <Link to="/menu/categorias" className="underline">
                        Agregar
                      </Link>
                    </div>
                  ) : (
                    subsFiltradas.map((s) => (
                      <SelectItem key={s.id_subcategoria} value={s.id_subcategoria}>
                        {s.nombre}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
        </section>

        <section
          className={cn(
            "rounded-lg border bg-card p-4 space-y-4 transition-opacity animate-fade-in",
            !idSubcategoria && "opacity-50 pointer-events-none",
          )}
        >
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
              2
            </span>
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
            <Input
              id="nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej. Limonada de coco"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="desc">Descripción (opcional)</Label>
              <Textarea
                id="desc"
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                rows={2}
                placeholder="Notas internas sobre la preparación"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tprep">Tiempo de preparación (min)</Label>
              <Input
                id="tprep"
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                placeholder="Ej: 15"
                value={tiempoPrep}
                onChange={(e) => setTiempoPrep(e.target.value.replace(/[^0-9]/g, ""))}
                onBlur={() => {
                  const n = Math.floor(Number(tiempoPrep) || 0);
                  setTiempoPrep(n > 0 ? String(n) : "");
                }}
              />
              <p className="text-xs text-muted-foreground">
                Las bebidas se sincronizan con la mitad del tiempo del plato más lento del pedido.
              </p>
            </div>
          </div>
        </section>

        <section
          className={cn(
            "rounded-lg border bg-card p-4 space-y-4 animate-fade-in",
            !nombre.trim() && "opacity-50 pointer-events-none",
          )}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                3
              </span>
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
              {ingredientes.length === 0
                ? "Tu lista de ingredientes está vacía"
                : `${ingredientes.length} ingrediente${ingredientes.length === 1 ? "" : "s"}`}
            </h3>
            {ingredientes.map((ing) => (
              <div
                key={ing.id_insumo}
                className="flex items-center gap-2 rounded-md border bg-background p-3 animate-scale-in"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{ing.nombre_insumo}</p>
                  <p className="text-xs text-muted-foreground">{ing.unidad_receta}</p>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    className="h-8 w-8"
                    onClick={() => stepCantidad(ing.id_insumo, -1)}
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </Button>
                  <Input
                    type="text"
                    inputMode="decimal"
                    placeholder="0"
                    title="Acepta decimales (0.5) o fracciones (1/2, 1 1/2)"
                    defaultValue={formatCantidadDisplay(ing.cantidad)}
                    key={`${ing.id_insumo}-${ing.cantidad}`}
                    onChange={(e) => {
                      // permite escribir libremente decimales, comas, "/" y espacios
                      const raw = e.target.value.replace(/[^0-9.,/\s]/g, "");
                      if (raw !== e.target.value) e.target.value = raw;
                      // intento optimista: si ya es un número o fracción válida, actualiza el modelo
                      const parsed = parseCantidadTexto(raw);
                      if (parsed !== null) setCantidad(ing.id_insumo, parsed);
                    }}
                    onBlur={(e) => {
                      const parsed = parseCantidadTexto(e.target.value);
                      const val = parsed ?? 0;
                      setCantidad(ing.id_insumo, val);
                      e.target.value = formatCantidadDisplay(val);
                    }}
                    className="h-8 w-20 text-center tabular-nums"
                  />

                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    className="h-8 w-8"
                    onClick={() => stepCantidad(ing.id_insumo, 1)}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-destructive"
                  onClick={() => quitar(ing.id_insumo)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </section>

        <section
          className={cn(
            "rounded-lg border bg-card p-4 space-y-4 animate-fade-in",
            ingredientes.length === 0 && "opacity-50 pointer-events-none",
          )}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                4
              </span>
              <h2 className="text-base font-semibold">Extras permitidos (opcional)</h2>
            </div>
            <Badge variant="secondary">{Object.keys(extras).length} marcado(s)</Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Insumos que el cliente podrá agregar como extra al producto final. Configura cantidad
            por porción y precio.
          </p>

          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={extrasSearch}
              onChange={(e) => setExtrasSearch(e.target.value)}
              placeholder="Filtrar insumos…"
              className="pl-9"
            />
          </div>

          <div className="rounded-md border max-h-96 overflow-y-auto divide-y">
            {insumosExtrasFiltrados.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground text-center">Sin coincidencias.</p>
            ) : (
              insumosExtrasFiltrados.map((i) => {
                const marcado = !!extras[i.id_insumo];
                const e = extras[i.id_insumo];
                return (
                  <div key={i.id_insumo} className="p-2.5 space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <Checkbox
                        checked={marcado}
                        onCheckedChange={(c) => toggleExtra(i, Boolean(c))}
                      />
                      <span className="text-sm font-medium flex-1">{i.nombre_insumo}</span>
                      <Badge variant="outline" className="text-xs">
                        {i.unidad_receta}
                      </Badge>
                    </label>
                    {marcado && (
                      <div className="grid grid-cols-2 gap-2 pl-6 animate-fade-in">
                        <div className="space-y-1">
                          <Label className="text-xs">Porción ({i.unidad_receta})</Label>
                          <Input
                            type="number"
                            step="any"
                            min={0.01}
                            value={e.cantidad_porcion}
                            onChange={(ev) =>
                              setExtraField(
                                i.id_insumo,
                                "cantidad_porcion",
                                Number(ev.target.value) || 0,
                              )
                            }
                            className="h-8"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Precio extra</Label>
                          <Input
                            type="number"
                            step="any"
                            min={0}
                            value={e.precio_extra}
                            onChange={(ev) =>
                              setExtraField(
                                i.id_insumo,
                                "precio_extra",
                                Number(ev.target.value) || 0,
                              )
                            }
                            className="h-8"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </section>

        <section
          className={cn(
            "rounded-lg border bg-card p-4 space-y-4 animate-fade-in",
            ingredientes.length === 0 && "opacity-50 pointer-events-none",
          )}
        >
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
              5
            </span>
            <h2 className="text-base font-semibold">Variantes (opciones acompañantes)</h2>
          </div>
          {mode === "edit" && idReceta ? (
            <VariantesBuilder idReceta={idReceta} />
          ) : (
            <p className="text-sm text-muted-foreground">
              Guarda la receta primero para configurar variantes. Cada opción apunta a un insumo y
              descuenta su porción del inventario al preparar el pedido.
            </p>
          )}
        </section>

        <div className="fixed bottom-0 left-0 right-0 border-t bg-background/95 backdrop-blur p-3 z-30">
          <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground hidden sm:block">
              {ingredientes.length > 0
                ? `${ingredientes.length} ingrediente${ingredientes.length === 1 ? "" : "s"} · ${Object.keys(extras).length} extra(s)`
                : "Agrega ingredientes para continuar"}
            </p>
            <div className="flex gap-2 w-full sm:w-auto">
              <Button variant="outline" className="flex-1 sm:flex-none" asChild>
                <Link to="/menu/recetas">Cancelar</Link>
              </Button>
              <Button
                onClick={guardar}
                disabled={!puedeGuardar || saving}
                className="flex-1 sm:flex-none"
              >
                {saving ? "Guardando…" : mode === "create" ? "Crear receta" : "Guardar cambios"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
