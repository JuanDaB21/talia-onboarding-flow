import { z } from "zod";

export const mesaSchema = z.object({
  identificador: z
    .string()
    .trim()
    .min(1, "Requerido")
    .max(80, "Máximo 80 caracteres"),
});

export type MesaInput = z.infer<typeof mesaSchema>;

export interface Mesa {
  id_mesa: string;
  id_negocio: string;
  identificador: string;
  estado: string;
  created_at: string;
  updated_at: string;
}
