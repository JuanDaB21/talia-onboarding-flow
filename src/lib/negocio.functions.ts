// Negocio (tenant): lectura, apariencia y propinas vía REST del backend Talia.
import { api } from "@/lib/api-client";
import type { TipoFondoMenu } from "@/lib/menu-publico.functions";

export interface NegocioConfig {
  id_negocio: string;
  nombre_comercial: string;
  url_logo: string | null;
  tema_menu: string;
  /** Fondo multimedia de la carta pública (0060). */
  menu_fondo_tipo: TipoFondoMenu;
  menu_fondo_url: string | null;
  menu_fondo_poster_url: string | null;
  menu_fondo_oscurecer: number;
  porcentaje_retencion_propina: number;
  /** % de propina sugerido al cliente en la precuenta impresa. */
  propina_pct_sugerida: number;
  /** Aviso que acompaña esa propina en el papel. */
  propina_mensaje: string;
  auto_cierre_turno_horas: number;
  /** Hora local a la que inicia el día operativo de caja ("HH:MM"). */
  dia_operativo_inicio: string;
  /** Duración informativa de la jornada en horas (1-24). */
  dia_operativo_duracion_horas: number;
  /** Domicilios y redes (0059): contacto público y reglas del pedido en línea. */
  whatsapp_numero: string | null;
  instagram_url: string | null;
  domicilios_activo: boolean;
  recoger_activo: boolean;
  tiempo_estimado_min: number | null;
  pedido_minimo: number;
}

// GET /negocio (fila completa del tenant). Se normaliza tema por defecto y se
// coacciona el numeric (pg lo serializa como string) a número.
export async function getNegocioConfig(): Promise<NegocioConfig> {
  const n = await api.get<{
    id_negocio: string;
    nombre_comercial: string;
    url_logo: string | null;
    tema_menu: string | null;
    menu_fondo_tipo: TipoFondoMenu | null;
    menu_fondo_url: string | null;
    menu_fondo_poster_url: string | null;
    menu_fondo_oscurecer: number | string | null;
    porcentaje_retencion_propina: number | string | null;
    propina_pct_sugerida: number | string | null;
    propina_mensaje: string | null;
    auto_cierre_turno_horas: number | string | null;
    dia_operativo_inicio: string | null;
    dia_operativo_duracion_horas: number | string | null;
    whatsapp_numero: string | null;
    instagram_url: string | null;
    domicilios_activo: boolean | null;
    recoger_activo: boolean | null;
    tiempo_estimado_min: number | string | null;
    pedido_minimo: number | string | null;
  }>("/negocio");
  return {
    id_negocio: n.id_negocio,
    nombre_comercial: n.nombre_comercial,
    url_logo: n.url_logo,
    tema_menu: n.tema_menu ?? "verde-bosque",
    menu_fondo_tipo: n.menu_fondo_tipo ?? "NINGUNO",
    menu_fondo_url: n.menu_fondo_url ?? null,
    menu_fondo_poster_url: n.menu_fondo_poster_url ?? null,
    menu_fondo_oscurecer: Number(n.menu_fondo_oscurecer ?? 55),
    porcentaje_retencion_propina: Number(n.porcentaje_retencion_propina ?? 0),
    propina_pct_sugerida: Number(n.propina_pct_sugerida ?? 10),
    propina_mensaje: n.propina_mensaje ?? "",
    auto_cierre_turno_horas: Number(n.auto_cierre_turno_horas ?? 12),
    // pg serializa time como "HH:MM:SS" → normalizar a "HH:MM" (input type=time).
    dia_operativo_inicio: (n.dia_operativo_inicio ?? "00:00").slice(0, 5),
    dia_operativo_duracion_horas: Number(n.dia_operativo_duracion_horas ?? 24),
    whatsapp_numero: n.whatsapp_numero ?? null,
    instagram_url: n.instagram_url ?? null,
    domicilios_activo: n.domicilios_activo === true,
    recoger_activo: n.recoger_activo === true,
    tiempo_estimado_min: n.tiempo_estimado_min == null ? null : Number(n.tiempo_estimado_min),
    pedido_minimo: Number(n.pedido_minimo ?? 0),
  };
}

// PATCH /negocio — domicilios y redes (solo ADMIN, validado en el backend).
export async function updateNegocioDomicilios(input: {
  whatsapp_numero?: string | null;
  instagram_url?: string | null;
  domicilios_activo?: boolean;
  recoger_activo?: boolean;
  tiempo_estimado_min?: number | null;
  pedido_minimo?: number;
}): Promise<{ ok: true }> {
  const patch = Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined));
  if (Object.keys(patch).length === 0) return { ok: true };
  await api.patch("/negocio", patch);
  return { ok: true };
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

export interface AparienciaPatch {
  tema_menu?: string;
  url_logo?: string | null;
  menu_fondo_tipo?: TipoFondoMenu;
  menu_fondo_url?: string | null;
  menu_fondo_poster_url?: string | null;
  menu_fondo_oscurecer?: number;
}

// PATCH /negocio — solo apariencia (tema/logo/fondo de la carta). Validación en el backend.
export async function updateNegocioApariencia(input: AparienciaPatch): Promise<{ ok: true }> {
  const patch = Object.fromEntries(
    Object.entries(input).filter(([, v]) => v !== undefined),
  ) as AparienciaPatch;
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

// PATCH /negocio — propina SUGERIDA al cliente: % y aviso que se imprimen en la
// precuenta. Distinta de la retención de arriba, que reparte lo ya cobrado.
export async function updateNegocioPropinaSugerida(input: {
  propina_pct_sugerida?: number;
  propina_mensaje?: string;
}): Promise<{ ok: true }> {
  const patch: { propina_pct_sugerida?: number; propina_mensaje?: string } = {};
  if (input.propina_pct_sugerida !== undefined)
    patch.propina_pct_sugerida = input.propina_pct_sugerida;
  if (input.propina_mensaje !== undefined) patch.propina_mensaje = input.propina_mensaje;
  if (Object.keys(patch).length === 0) return { ok: true };
  await api.patch("/negocio", patch);
  return { ok: true };
}
