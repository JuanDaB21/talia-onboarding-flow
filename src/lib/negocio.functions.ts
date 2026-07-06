// Negocio (tenant): lectura, apariencia y propinas vía REST del backend Talia.
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

// PATCH /negocio — retención de propina (solo ADMIN, validado en el backend).
export async function updateNegocioPropinas(input: {
  porcentaje_retencion_propina: number;
}): Promise<{ ok: true }> {
  await api.patch("/negocio", {
    porcentaje_retencion_propina: input.porcentaje_retencion_propina,
  });
  return { ok: true };
}
