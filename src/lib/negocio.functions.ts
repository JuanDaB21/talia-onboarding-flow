import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { MENU_THEME_IDS } from "@/lib/menu-themes";

export interface NegocioConfig {
  id_negocio: string;
  nombre_comercial: string;
  url_logo: string | null;
  tema_menu: string;
}

export const getNegocioConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("negocio")
      .select("id_negocio, nombre_comercial, url_logo, tema_menu")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error("Negocio no encontrado");
    const out: NegocioConfig = {
      id_negocio: data.id_negocio,
      nombre_comercial: data.nombre_comercial,
      url_logo: data.url_logo,
      tema_menu: data.tema_menu ?? "verde-bosque",
    };
    return out;
  });

const aparienciaSchema = z.object({
  tema_menu: z.enum(MENU_THEME_IDS as [string, ...string[]]).optional(),
  url_logo: z.string().url().nullable().optional(),
});

export const updateNegocioApariencia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => aparienciaSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const patch: Record<string, unknown> = {};
    if (data.tema_menu !== undefined) patch.tema_menu = data.tema_menu;
    if (data.url_logo !== undefined) patch.url_logo = data.url_logo;
    if (Object.keys(patch).length === 0) return { ok: true };

    const { data: neg, error: nErr } = await supabase
      .from("negocio")
      .select("id_negocio")
      .maybeSingle();
    if (nErr) throw new Error(nErr.message);
    if (!neg) throw new Error("Negocio no encontrado");

    const { error } = await supabase
      .from("negocio")
      .update(patch)
      .eq("id_negocio", neg.id_negocio);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
