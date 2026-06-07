import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const checkCorreoDisponible = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({ correo: z.string().trim().toLowerCase().email().max(255) }).parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // listUsers no permite filtrar por email directamente en todas las versiones;
    // usamos getUserByEmail via admin API si está disponible, sino paginamos.
    // @ts-expect-error - getUserByEmail existe en versiones recientes del SDK admin
    if (typeof supabaseAdmin.auth.admin.getUserByEmail === "function") {
      // @ts-expect-error - ver arriba
      const { data: res } = await supabaseAdmin.auth.admin.getUserByEmail(data.correo);
      return { disponible: !res?.user };
    }
    // Fallback: buscar en usuarios_staff por correo
    const { data: staff } = await supabaseAdmin
      .from("usuarios_staff")
      .select("id_usuario")
      .eq("correo", data.correo)
      .maybeSingle();
    return { disponible: !staff };
  });
