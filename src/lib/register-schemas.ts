import { z } from "zod";

export const step1Schema = z
  .object({
    nombre: z
      .string()
      .trim()
      .min(2, "Mínimo 2 caracteres")
      .max(80, "Máximo 80 caracteres"),
    correo: z
      .string()
      .trim()
      .toLowerCase()
      .email("Correo no válido")
      .max(255),
    password: z
      .string()
      .min(8, "Mínimo 8 caracteres")
      .max(72, "Máximo 72 caracteres")
      .regex(/[A-Z]/, "Debe incluir una mayúscula")
      .regex(/[a-z]/, "Debe incluir una minúscula")
      .regex(/[0-9]/, "Debe incluir un número"),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    message: "Las contraseñas no coinciden",
    path: ["confirm"],
  });

export const step2Schema = z.object({
  nombre_comercial: z.string().trim().min(2, "Requerido").max(120),
  razon_social: z.string().trim().min(2, "Requerido").max(160),
  documento_tributario: z
    .string()
    .trim()
    .min(5, "Mínimo 5 caracteres")
    .max(32, "Máximo 32 caracteres")
    .regex(/^[A-Za-z0-9.\-]+$/, "Solo letras, números, punto y guion"),
  telefono_contacto: z
    .string()
    .trim()
    .min(6, "Teléfono no válido")
    .max(20)
    .regex(/^[0-9+()\-\s]+$/, "Formato no válido"),
  direccion: z.string().trim().min(5, "Requerido").max(200),
});

export type Step1Values = z.infer<typeof step1Schema>;
export type Step2Values = z.infer<typeof step2Schema>;
