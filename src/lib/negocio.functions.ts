import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { MENU_THEME_IDS } from "@/lib/menu-themes";

export interface NegocioConfig {
  id_negocio: string;
  nombre_comercial: string;
  url_logo: string | null;
  tema_menu: string;
  porcentaje_retencion_propina: number;
}

export const getNegocioConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("negocio")
      .select("id_negocio, nombre_comercial, url_logo, tema_menu, porcentaje_retencion_propina")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error("Negocio no encontrado");
    const out: NegocioConfig = {
      id_negocio: data.id_negocio,
      nombre_comercial: data.nombre_comercial,
      url_logo: data.url_logo,
      tema_menu: data.tema_menu ?? "verde-bosque",
      porcentaje_retencion_propina: Number(
        (data as { porcentaje_retencion_propina?: number | string | null })
          .porcentaje_retencion_propina ?? 0,
      ),
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
    const patch: { tema_menu?: string; url_logo?: string | null } = {};
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

const propinasSchema = z.object({
  porcentaje_retencion_propina: z.number().min(0).max(100),
});

export const updateNegocioPropinas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => propinasSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin, error: roleErr } = await supabase.rpc("is_admin_actual");
    if (roleErr) throw new Error(roleErr.message);
    if (!isAdmin) throw new Error("Solo administradores pueden modificar este valor");

    const { data: neg, error: nErr } = await supabase
      .from("negocio")
      .select("id_negocio")
      .maybeSingle();
    if (nErr) throw new Error(nErr.message);
    if (!neg) throw new Error("Negocio no encontrado");

    const { error } = await supabase
      .from("negocio")
      .update({ porcentaje_retencion_propina: data.porcentaje_retencion_propina })
      .eq("id_negocio", neg.id_negocio);
    if (error) throw new Error(error.message);
    void userId;
    return { ok: true };
  });
