import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const ROLES_UI = ["ADMIN", "MESERO", "COCINA", "BARRA"] as const;
const rolEnum = z.enum(ROLES_UI);
const estadoEnum = z.enum(["ACTIVO", "INACTIVO"]);

const passwordRules = z
  .string()
  .min(8)
  .max(72)
  .regex(/[A-Z]/)
  .regex(/[a-z]/)
  .regex(/[0-9]/);

async function getCallerNegocio(userId: string): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from("usuarios_staff")
    .select("id_negocio")
    .eq("id_usuario", userId)
    .maybeSingle();
  if (error || !data?.id_negocio) {
    throw new Error("No autorizado");
  }
  return data.id_negocio;
}

async function assertTargetSameNegocio(
  idUsuarioTarget: string,
  idNegocio: string,
) {
  const { data, error } = await supabaseAdmin
    .from("usuarios_staff")
    .select("id_negocio, rol")
    .eq("id_usuario", idUsuarioTarget)
    .maybeSingle();
  if (error || !data) throw new Error("Usuario no encontrado");
  if (data.id_negocio !== idNegocio) throw new Error("No autorizado");
  if (data.rol === "SUPERADMIN") throw new Error("No se puede modificar a un superadministrador");
}

export const crearUsuarioStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        nombre: z.string().trim().min(2).max(80),
        correo: z.string().trim().toLowerCase().email().max(255),
        password: passwordRules,
        rol: rolEnum,
        estado: z.boolean(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const idNegocio = await getCallerNegocio(context.userId);

    const { data: created, error: authErr } =
      await supabaseAdmin.auth.admin.createUser({
        email: data.correo,
        password: data.password,
        email_confirm: true,
      });
    if (authErr || !created?.user) {
      throw new Error(authErr?.message ?? "No se pudo crear el usuario");
    }

    const newUserId = created.user.id;
    const { error: insErr } = await supabaseAdmin
      .from("usuarios_staff")
      .insert({
        id_usuario: newUserId,
        id_negocio: idNegocio,
        nombre: data.nombre,
        correo: data.correo,
        rol: data.rol,
        estado: data.estado ? "ACTIVO" : "INACTIVO",
      });

    if (insErr) {
      await supabaseAdmin.auth.admin.deleteUser(newUserId).catch(() => {});
      throw new Error(insErr.message);
    }

    return { id_usuario: newUserId };
  });

export const actualizarUsuarioStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        id_usuario: z.string().uuid(),
        nombre: z.string().trim().min(2).max(80),
        rol: rolEnum,
        estado: z.boolean(),
        password: z.string().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const idNegocio = await getCallerNegocio(context.userId);
    await assertTargetSameNegocio(data.id_usuario, idNegocio);

    const { error: updErr } = await supabaseAdmin
      .from("usuarios_staff")
      .update({
        nombre: data.nombre,
        rol: data.rol,
        estado: data.estado ? "ACTIVO" : "INACTIVO",
      })
      .eq("id_usuario", data.id_usuario);
    if (updErr) throw new Error(updErr.message);

    if (data.password && data.password.length > 0) {
      const parsed = passwordRules.safeParse(data.password);
      if (!parsed.success) throw new Error("Contraseña inválida");
      const { error: pwErr } = await supabaseAdmin.auth.admin.updateUserById(
        data.id_usuario,
        { password: data.password },
      );
      if (pwErr) throw new Error(pwErr.message);
    }

    return { ok: true };
  });

export const eliminarUsuarioStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ id_usuario: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const idNegocio = await getCallerNegocio(context.userId);
    await assertTargetSameNegocio(data.id_usuario, idNegocio);

    const { error: delErr } = await supabaseAdmin
      .from("usuarios_staff")
      .delete()
      .eq("id_usuario", data.id_usuario);
    if (delErr) throw new Error(delErr.message);

    const { error: authErr } = await supabaseAdmin.auth.admin.deleteUser(
      data.id_usuario,
    );
    if (authErr) throw new Error(authErr.message);

    return { ok: true };
  });
