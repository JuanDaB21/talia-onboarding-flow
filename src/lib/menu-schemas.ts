import { z } from "zod";

export const categoriaSchema = z.object({
  nombre: z.string().trim().min(1, "Requerido").max(120),
});
export type CategoriaInput = z.infer<typeof categoriaSchema>;

export const subcategoriaSchema = z.object({
  nombre: z.string().trim().min(1, "Requerido").max(120),
  id_categoria: z.string().uuid("Selecciona una categoría"),
});
export type SubcategoriaInput = z.infer<typeof subcategoriaSchema>;

export const ingredienteSchema = z.object({
  id_insumo: z.string().uuid(),
  nombre_insumo: z.string(),
  unidad_receta: z.string(),
  cantidad: z.coerce.number().gt(0, "Debe ser > 0"),
});
export type IngredienteInput = z.infer<typeof ingredienteSchema>;

export const recetaSchema = z.object({
  nombre_receta: z.string().trim().min(1, "Requerido").max(200),
  descripcion: z.string().trim().max(1000).optional(),
  id_categoria: z.string().uuid("Selecciona una categoría"),
  id_subcategoria: z.string().uuid("Selecciona una subcategoría"),
  ingredientes: z.array(ingredienteSchema).min(1, "Agrega al menos un ingrediente"),
});
export type RecetaInput = z.infer<typeof recetaSchema>;

export const productoSchema = z.object({
  descripcion_producto: z.string().trim().max(1000).optional(),
  precio_venta: z.coerce.number().min(0, "Debe ser ≥ 0"),
  activo: z.boolean(),
  facturable: z.boolean(),
});
export type ProductoInput = z.infer<typeof productoSchema>;


export const extraSchema = z.object({
  id_insumo_extra: z.string().uuid(),
  cantidad_porcion: z.coerce.number().gt(0, "Debe ser > 0"),
  precio_extra: z.coerce.number().min(0, "Debe ser ≥ 0"),
});
export type ExtraInput = z.infer<typeof extraSchema>;

// Variantes por receta (ej. "Tipo de papa" con opciones papa francesa/criolla).
// Cada opción apunta a un insumo y consume cantidad por porción del inventario.
export const varianteOpcionSchema = z.object({
  id_opcion: z.string().uuid().optional(),
  id_insumo_opcion: z.string().uuid("Selecciona un insumo"),
  cantidad_porcion: z.coerce.number().gt(0, "Debe ser > 0"),
  precio_delta: z.coerce.number().min(0, "Debe ser ≥ 0").default(0),
  orden: z.coerce.number().int().min(0).default(0),
});
export type VarianteOpcionInput = z.infer<typeof varianteOpcionSchema>;

export const varianteGrupoSchema = z.object({
  id_grupo: z.string().uuid().optional(),
  nombre: z.string().trim().min(1, "Requerido").max(80),
  seleccion: z.enum(["UNICA", "MULTIPLE"]),
  orden: z.coerce.number().int().min(0).default(0),
  opciones: z.array(varianteOpcionSchema).min(1, "Agrega al menos una opción"),
});
export type VarianteGrupoInput = z.infer<typeof varianteGrupoSchema>;

export const guardarVariantesSchema = z.object({
  idReceta: z.string().uuid(),
  grupos: z.array(varianteGrupoSchema).max(20),
});
export type GuardarVariantesInput = z.infer<typeof guardarVariantesSchema>;
