import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const checkCorreoDisponible = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({ correo: z.string().trim().toLowerCase().email().max(255) }).parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: staff } = await supabaseAdmin
      .from("usuarios_staff")
      .select("id_usuario")
      .eq("correo", data.correo)
      .maybeSingle();
    return { disponible: !staff };
  });
