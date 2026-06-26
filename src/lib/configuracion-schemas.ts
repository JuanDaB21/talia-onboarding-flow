import { z } from "zod";

export const ROLES_UI = ["ADMIN", "CAJERO", "MESERO", "COCINA", "BARRA", "ESTACION"] as const;
export const rolStaffUiSchema = z.enum(ROLES_UI);
export type RolStaffUi = z.infer<typeof rolStaffUiSchema>;

const passwordRules = z
  .string()
  .min(8, "Mínimo 8 caracteres")
  .max(72, "Máximo 72 caracteres")
  .regex(/[A-Z]/, "Debe incluir una mayúscula")
  .regex(/[a-z]/, "Debe incluir una minúscula")
  .regex(/[0-9]/, "Debe incluir un número");

const idEspacioOpcional = z.string().uuid().nullable().optional();

export const usuarioCreateSchema = z
  .object({
    nombre: z.string().trim().min(2, "Mínimo 2 caracteres").max(80),
    correo: z.string().trim().toLowerCase().email("Correo no válido").max(255),
    password: passwordRules,
    rol: rolStaffUiSchema,
    id_espacio_asignado: idEspacioOpcional,
    estado: z.boolean(),
    recibe_propinas: z.boolean(),
  })
  .refine(
    (v) =>
      !(v.rol === "COCINA" || v.rol === "BARRA" || v.rol === "ESTACION") ||
      !!v.id_espacio_asignado,
    { message: "Selecciona el espacio de trabajo", path: ["id_espacio_asignado"] },
  );
export type UsuarioCreateInput = z.infer<typeof usuarioCreateSchema>;

export const usuarioUpdateSchema = z
  .object({
    nombre: z.string().trim().min(2, "Mínimo 2 caracteres").max(80),
    rol: rolStaffUiSchema,
    id_espacio_asignado: idEspacioOpcional,
    estado: z.boolean(),
    recibe_propinas: z.boolean(),
    password: z
      .string()
      .optional()
      .refine((v) => !v || passwordRules.safeParse(v).success, {
        message: "Mín 8, mayúscula, minúscula y número",
      }),
  })
  .refine(
    (v) =>
      !(v.rol === "COCINA" || v.rol === "BARRA" || v.rol === "ESTACION") ||
      !!v.id_espacio_asignado,
    { message: "Selecciona el espacio de trabajo", path: ["id_espacio_asignado"] },
  );
export type UsuarioUpdateInput = z.infer<typeof usuarioUpdateSchema>;
