// Negocio (tenant): lectura, apariencia y propinas vía REST del backend Talia.
import { api } from "@/lib/api-client";

export interface NegocioConfig {
  id_negocio: string;
  nombre_comercial: string;
  url_logo: string | null;
  tema_menu: string;
  porcentaje_retencion_propina: number;
  auto_cierre_turno_horas: number;
  /** Hora local a la que inicia el día operativo de caja ("HH:MM"). */
  dia_operativo_inicio: string;
  /** Duración informativa de la jornada en horas (1-24). */
  dia_operativo_duracion_horas: number;
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
    auto_cierre_turno_horas: number | string | null;
    dia_operativo_inicio: string | null;
    dia_operativo_duracion_horas: number | string | null;
  }>("/negocio");
  return {
    id_negocio: n.id_negocio,
    nombre_comercial: n.nombre_comercial,
    url_logo: n.url_logo,
    tema_menu: n.tema_menu ?? "verde-bosque",
    porcentaje_retencion_propina: Number(n.porcentaje_retencion_propina ?? 0),
    auto_cierre_turno_horas: Number(n.auto_cierre_turno_horas ?? 12),
    // pg serializa time como "HH:MM:SS" → normalizar a "HH:MM" (input type=time).
    dia_operativo_inicio: (n.dia_operativo_inicio ?? "00:00").slice(0, 5),
    dia_operativo_duracion_horas: Number(n.dia_operativo_duracion_horas ?? 24),
  };
}

// PATCH /negocio — día operativo de caja (solo ADMIN, validado en backend).
// El backend responde 409 CAJA_ABIERTA si se intenta cambiar la hora con caja abierta.
export async function updateNegocioDiaOperativo(input: {
  dia_operativo_inicio: string;
  dia_operativo_duracion_horas: number;
}): Promise<{ ok: true }> {
  await api.patch("/negocio", {
    dia_operativo_inicio: input.dia_operativo_inicio,
    dia_operativo_duracion_horas: input.dia_operativo_duracion_horas,
  });
  return { ok: true };
}

// PATCH /negocio — horas de cierre automático del turno (solo ADMIN, validado en backend).
export async function updateNegocioCierreTurno(input: {
  auto_cierre_turno_horas: number;
}): Promise<{ ok: true }> {
  await api.patch("/negocio", {
    auto_cierre_turno_horas: input.auto_cierre_turno_horas,
  });
  return { ok: true };
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
