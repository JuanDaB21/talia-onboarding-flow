// Módulo de menú (categorías, subcategorías, productos, recetas) vía REST del
// backend Talia (/menu/*). Reemplaza los supabase.from/rpc inline de los
// componentes de menú. Los insumos se leen de /bodega/insumos.
import { api } from "@/lib/api-client";

// ── Categorías / subcategorías ──────────────────────────────────────────────
export interface Categoria {
  id_categoria: string;
  nombre: string;
  destino: string;
  orden: number;
}
export interface Subcategoria {
  id_subcategoria: string;
  id_categoria: string;
  nombre: string;
  orden: number;
}

export function listarCategorias() {
  return api.get<Categoria[]>("/menu/categorias");
}

export function listarSubcategorias() {
  return api.get<Subcategoria[]>("/menu/subcategorias");
}

export function crearCategoria(input: { nombre: string; destino: string }) {
  return api.post<Categoria>("/menu/categorias", { nombre: input.nombre, destino: input.destino });
}

export function renombrarCategoria(input: { id_categoria: string; nombre: string }) {
  return api.patch<{ ok: true }>(`/menu/categorias/${input.id_categoria}`, {
    nombre: input.nombre,
  });
}

/** Mueve la categoría a otro espacio de trabajo (RPC set_categoria_destino). */
export function setCategoriaDestino(input: { id_categoria: string; destino: string }) {
  return api.post<{ updated_items?: number }>(`/menu/categorias/${input.id_categoria}/destino`, {
    destino: input.destino,
  });
}

export function eliminarCategoria(input: { id_categoria: string }) {
  return api.del<{ ok: true }>(`/menu/categorias/${input.id_categoria}`);
}

export function reordenarCategorias(items: Array<{ id: string; orden: number }>) {
  return api.patch<{ ok: true }>("/menu/categorias/orden", { items });
}

export function crearSubcategoria(input: { id_categoria: string; nombre: string }) {
  return api.post<Subcategoria>("/menu/subcategorias", {
    id_categoria: input.id_categoria,
    nombre: input.nombre,
  });
}

export function renombrarSubcategoria(input: { id_subcategoria: string; nombre: string }) {
  return api.patch<{ ok: true }>(`/menu/subcategorias/${input.id_subcategoria}`, {
    nombre: input.nombre,
  });
}

export function eliminarSubcategoria(input: { id_subcategoria: string }) {
  return api.del<{ ok: true }>(`/menu/subcategorias/${input.id_subcategoria}`);
}

export function reordenarSubcategorias(items: Array<{ id: string; orden: number }>) {
  return api.patch<{ ok: true }>("/menu/subcategorias/orden", { items });
}

// ── Productos ───────────────────────────────────────────────────────────────
export interface ProductoRow {
  id_producto: string;
  id_receta: string;
  nombre_producto: string;
  descripcion_producto: string | null;
  precio_venta: number;
  url_imagen: string | null;
  activo: boolean;
  facturable: boolean;
}

export function listarProductos() {
  return api.get<ProductoRow[]>("/menu/productos");
}

export function actualizarProducto(input: {
  id_producto: string;
  descripcion_producto?: string | null;
  precio_venta?: number;
  url_imagen?: string | null;
  activo?: boolean;
  facturable?: boolean;
}) {
  const { id_producto, ...campos } = input;
  return api.patch<{ ok: true }>(`/menu/productos/${id_producto}`, campos);
}

// ── Insumos (para el builder de recetas) ────────────────────────────────────
export interface Insumo {
  id_insumo: string;
  nombre_insumo: string;
  unidad_receta: string;
}

export function listarInsumos() {
  return api.get<Insumo[]>("/bodega/insumos");
}

// ── Recetas ─────────────────────────────────────────────────────────────────
export interface RecetaMasterRow {
  id_receta: string;
  id_categoria: string;
  id_subcategoria: string;
  nombre_receta: string;
  descripcion: string | null;
  tiempo_preparacion_min: number;
  created_at: string;
}

export interface RecetaConNombres {
  id_receta: string;
  nombre_receta: string;
  categorias: { nombre: string } | null;
  subcategorias: { nombre: string } | null;
}

/** Lista de recetas con nombres de categoría/subcategoría resueltos (join en cliente). */
export async function listarRecetasConNombres(): Promise<RecetaConNombres[]> {
  const [recetas, cats, subs] = await Promise.all([
    api.get<RecetaMasterRow[]>("/menu/recetas"),
    listarCategorias(),
    listarSubcategorias(),
  ]);
  const catName = new Map(cats.map((c) => [c.id_categoria, c.nombre]));
  const subName = new Map(subs.map((s) => [s.id_subcategoria, s.nombre]));
  return recetas.map((r) => ({
    id_receta: r.id_receta,
    nombre_receta: r.nombre_receta,
    categorias: catName.has(r.id_categoria) ? { nombre: catName.get(r.id_categoria)! } : null,
    subcategorias: subName.has(r.id_subcategoria)
      ? { nombre: subName.get(r.id_subcategoria)! }
      : null,
  }));
}

export interface RecetaDetalle {
  receta: {
    id_receta: string;
    nombre_receta: string;
    descripcion: string | null;
    id_categoria: string;
    id_subcategoria: string;
    tiempo_preparacion_min: number;
  };
  ingredientes: Array<{
    id_insumo: string;
    nombre_insumo: string;
    unidad_receta: string;
    cantidad: number;
  }>;
  id_producto: string | null;
  extras: Array<{ id_insumo_extra: string; cantidad_porcion: number; precio_extra: number }>;
}

export function getRecetaDetalle(id_receta: string) {
  return api.get<RecetaDetalle>(`/menu/recetas/${id_receta}`);
}

export interface GuardarRecetaInput {
  idCategoria: string;
  idSubcategoria: string;
  nombre: string;
  descripcion?: string;
  ingredientes: Array<{ id_insumo: string; cantidad: number }>;
  tiempoPreparacionMin: number;
}

export function crearReceta(input: GuardarRecetaInput) {
  return api.post<{ idReceta: string }>("/menu/recetas", input);
}

export function actualizarReceta(id_receta: string, input: GuardarRecetaInput) {
  return api.put<{ idReceta: string }>(`/menu/recetas/${id_receta}`, input);
}

export function duplicarReceta(input: { id_receta: string }) {
  return api.post<{ idReceta: string }>(`/menu/recetas/${input.id_receta}/duplicar`);
}

export function eliminarReceta(input: { id_receta: string }) {
  return api.post<{ ok: true }>(`/menu/recetas/${input.id_receta}/eliminar`);
}

export function guardarExtras(input: {
  id_producto: string;
  extras: Array<{ id_insumo_extra: string; cantidad_porcion: number; precio_extra: number }>;
}) {
  return api.post<{ ok: true }>(`/menu/productos/${input.id_producto}/extras`, {
    extras: input.extras,
  });
}
