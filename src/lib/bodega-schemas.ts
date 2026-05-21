import { z } from "zod";

export const proveedorSchema = z.object({
  razon_social: z.string().trim().min(1, "Requerido").max(255),
  documento_tributario: z.string().trim().min(1, "Requerido").max(50),
  nombre_contacto: z.string().trim().min(1, "Requerido").max(255),
  telefono: z.string().trim().min(1, "Requerido").max(50),
  estado: z.boolean(),
});

export type ProveedorInput = z.infer<typeof proveedorSchema>;

export const insumoSchema = z.object({
  nombre_insumo: z.string().trim().min(1, "Requerido").max(255),
  unidad_medida: z.string().trim().min(1, "Requerido").max(50),
  costo_promedio: z.coerce.number().min(0, "Debe ser ≥ 0"),
  stock_minimo: z.coerce.number().min(0, "Debe ser ≥ 0"),
  unidad_compra: z.string().trim().min(1, "Requerido").max(50),
  unidad_receta: z.string().trim().min(1, "Requerido").max(50),
  factor_conversion: z.coerce.number().gt(0, "Debe ser > 0"),
});

export type InsumoInput = z.infer<typeof insumoSchema>;
