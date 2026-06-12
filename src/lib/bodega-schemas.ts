import { z } from "zod";
import { UNIDAD_CODES, combinacionPermitida, requiereFactorManual } from "./unidades";

export const proveedorSchema = z.object({
  razon_social: z.string().trim().min(1, "Requerido").max(255),
  documento_tributario: z.string().trim().min(1, "Requerido").max(50),
  nombre_contacto: z.string().trim().min(1, "Requerido").max(255),
  telefono: z.string().trim().min(1, "Requerido").max(50),
  estado: z.boolean(),
});

export type ProveedorInput = z.infer<typeof proveedorSchema>;

export const insumoSchema = z
  .object({
    nombre_insumo: z.string().trim().min(1, "Requerido").max(255),
    costo_promedio: z.coerce.number().min(0, "Debe ser ≥ 0"),
    stock_minimo: z.coerce.number().min(0, "Debe ser ≥ 0"),
    unidad_compra: z.enum(UNIDAD_CODES, { message: "Selecciona una unidad" }),
    unidad_receta: z.enum(UNIDAD_CODES, { message: "Selecciona una unidad" }),
    factor_conversion: z.coerce.number().gt(0, "Debe ser > 0"),
  })
  .superRefine((val, ctx) => {
    const fc = getFamilia(val.unidad_compra);
    const fr = getFamilia(val.unidad_receta);
    if (fc && fr && fc !== fr) {
      ctx.addIssue({
        code: "custom",
        path: ["unidad_receta"],
        message: "Debe pertenecer a la misma familia que la unidad de compra",
      });
    }
    if (!requiereFactorManual(val.unidad_compra) && val.unidad_compra === val.unidad_receta) {
      if (val.factor_conversion !== 1) {
        // No-op: este caso se fuerza desde la UI; aquí solo informativo.
      }
    }
  });

export type InsumoInput = z.infer<typeof insumoSchema>;
