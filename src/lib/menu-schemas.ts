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
  descripcion: z.string().trim().max(1000).optional().default(""),
  id_categoria: z.string().uuid("Selecciona una categoría"),
  id_subcategoria: z.string().uuid("Selecciona una subcategoría"),
  ingredientes: z.array(ingredienteSchema).min(1, "Agrega al menos un ingrediente"),
});
export type RecetaInput = z.infer<typeof recetaSchema>;

export const productoSchema = z.object({
  descripcion_producto: z.string().trim().max(1000).optional().default(""),
  precio_venta: z.coerce.number().min(0, "Debe ser ≥ 0"),
  url_imagen: z.string().trim().url("URL inválida").or(z.literal("")).optional(),
  activo: z.boolean(),
});
export type ProductoInput = z.infer<typeof productoSchema>;

export const extraSchema = z.object({
  id_insumo_extra: z.string().uuid(),
  cantidad_porcion: z.coerce.number().gt(0, "Debe ser > 0"),
  precio_extra: z.coerce.number().min(0, "Debe ser ≥ 0"),
});
export type ExtraInput = z.infer<typeof extraSchema>;
