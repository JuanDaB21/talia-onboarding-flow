// Negocio (tenant): lectura y apariencia vía REST del backend Talia.
// Excepción: updateNegocioPropinas sigue en Supabase — el backend aún no expone
// `porcentaje_retencion_propina` en PATCH /negocio (propinas se cutover-ea cuando lo cubra).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { api } from "@/lib/api-client";

export interface NegocioConfig {
  id_negocio: string;
  nombre_comercial: string;
  url_logo: string | null;
  tema_menu: string;
  porcentaje_retencion_propina: number;
}

// GET /negocio (fila completa del tenant). Se normaliza tema por defecto y se
// coacciona el numeric (pg lo serializa como string) a número.
export async function getNegocioConfig(): Promise<NegocioConfig> {
  const n = await api.get<{
    id_negocio: string;
    nombre_comercial: string;
    url_logo: string | null;
    tema_menu: string | null;
    porcentaje_retencion_propina: number | string | null;
  }>("/negocio");
  return {
    id_negocio: n.id_negocio,
    nombre_comercial: n.nombre_comercial,
    url_logo: n.url_logo,
    tema_menu: n.tema_menu ?? "verde-bosque",
    porcentaje_retencion_propina: Number(n.porcentaje_retencion_propina ?? 0),
  };
}

// PATCH /negocio — solo apariencia (tema/logo). Validación en el backend.
export async function updateNegocioApariencia(input: {
  tema_menu?: string;
  url_logo?: string | null;
}): Promise<{ ok: true }> {
  const patch: { tema_menu?: string; url_logo?: string | null } = {};
  if (input.tema_menu !== undefined) patch.tema_menu = input.tema_menu;
  if (input.url_logo !== undefined) patch.url_logo = input.url_logo;
  if (Object.keys(patch).length === 0) return { ok: true };
  await api.patch("/negocio", patch);
  return { ok: true };
}

const propinasSchema = z.object({
  porcentaje_retencion_propina: z.number().min(0).max(100),
});

// TODO(cutover): mover a REST cuando el backend exponga la retención de propina.
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
