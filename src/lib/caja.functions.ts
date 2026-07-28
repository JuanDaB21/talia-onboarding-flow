// Data-access de caja (arqueo diario) vía REST del backend Talia.
// Mismas firmas naturales que consumen los componentes; se dejó de usar Supabase
// (server functions) — todo el negocio vive ahora en el backend (/caja/*).
import { api } from "@/lib/api-client";

export interface ResumenCajaDia {
  caja: {
    id_caja: string;
    fecha: string;
    estado: "ABIERTA" | "CERRADA";
    base_inicial: number;
    abierta_at: string;
    cerrada_at: string | null;
    abierta_por_nombre: string | null;
    cerrada_por_nombre: string | null;
  } | null;
  efectivo: number;
  transferencia_confirmada: number;
  transferencia_pendiente: number;
  datafono: number;
  total_sistema: number;
  pagos_pendientes: number;
  mesas_abiertas: number;
  efectivo_por_mesero: Array<{ id_mesero: string | null; nombre: string; monto: number }>;
}

// GET /caja/estado → resumen_caja_dia() (jsonb) agregado en el backend.
export function getEstadoCaja() {
  return api.get<ResumenCajaDia>("/caja/estado");
}

export function abrirCaja(base: number) {
  return api.post<{ idCaja: string }>("/caja/abrir", { base });
}

export function reabrirCaja() {
  return api.post<{ idCaja: string }>("/caja/reabrir");
}

export interface CerrarCajaInput {
  efectivoFisico: number;
  datafonoFisico: number;
  nota?: string | null;
  ajustes?: Array<{ idTipo: string; monto: number; nota?: string | null }>;
}
export function cerrarCaja(input: CerrarCajaInput) {
  return api.post<{ idCaja: string }>("/caja/cerrar", input);
}

export interface AjusteTipo {
  id_tipo: string;
  nombre: string;
  signo: "POSITIVO" | "NEGATIVO";
  activo: boolean;
}

export function listarTiposAjuste() {
  return api.get<AjusteTipo[]>("/caja/tipos-ajuste");
}

export function crearTipoAjuste(input: { nombre: string; signo?: "POSITIVO" | "NEGATIVO" }) {
  return api.post<AjusteTipo>("/caja/tipos-ajuste", input);
}

export interface AjusteCajaRow {
  id_ajuste: string;
  id_tipo: string;
  nombre: string;
  signo: "POSITIVO" | "NEGATIVO";
  monto: number;
  nota: string | null;
  created_at: string;
}

export function listarAjustesCajaActual() {
  return api.get<AjusteCajaRow[]>("/caja/ajustes-actual");
}

export function crearAjusteCaja(input: { idTipo: string; monto: number; nota?: string | null }) {
  return api.post<{ idAjuste: string }>("/caja/ajustes", input);
}

export function eliminarAjusteCaja(idAjuste: string) {
  return api.post<{ ok: true }>(`/caja/ajustes/${idAjuste}/eliminar`);
}

// Con multi-caja (0026) puede haber varios cierres por fecha; el backend los
// ordena por fecha DESC, abierta_at DESC.
export interface CierreListItem {
  id_caja: string;
  fecha: string;
  estado: string;
  total: number;
  diferencia: number;
  abierta_at: string | null;
  cerrada_at: string | null;
  abierta_por_nombre: string | null;
  cerrada_por_nombre: string | null;
}

export function listarCierres(input?: { desde?: string | null; hasta?: string | null }) {
  const q = new URLSearchParams();
  if (input?.desde) q.set("desde", input.desde);
  if (input?.hasta) q.set("hasta", input.hasta);
  const qs = q.toString();
  return api.get<{ cierres: CierreListItem[] }>(`/caja/cierres${qs ? `?${qs}` : ""}`);
}

export interface CierreDetalle {
  id_caja: string;
  fecha: string;
  estado: string;
  base_inicial: number;
  efectivo_sistema: number;
  transferencia_sistema: number;
  datafono_sistema: number;
  efectivo_fisico: number;
  datafono_fisico: number;
  diferencia_efectivo: number;
  diferencia_datafono: number;
  nota_cuadre: string | null;
  abierta_at: string;
  cerrada_at: string | null;
  abierta_por_nombre: string | null;
  cerrada_por_nombre: string | null;
  negocio_nombre: string;
  /** Todo lo vendido en la ventana de esta caja (no un top-N), más vendido primero. */
  productos_vendidos: Array<{
    nombre: string;
    cantidad: number;
    total: number;
    /** `'Sin categoría'` para líneas libres (decoraciones) o productos borrados. */
    categoria: string;
  }>;
  /** Lo mismo agrupado por categoría, la que más facturó primero. */
  productos_por_categoria: Array<{
    categoria: string;
    cantidad: number;
    total: number;
    productos: Array<{ nombre: string; cantidad: number; total: number }>;
  }>;
  unidades_totales: number;
  /**
   * Propinas cobradas en esta caja. Informativas: NO entran en el total de ventas
   * ni en el cuadre (`pagos.monto` ya las incluye en los pagos divididos pero no en
   * los simples, así que sumarlas las contaría dos veces en la mitad de los casos).
   */
  propinas_total: number;
  propinas_efectivo: number;
  /** Hora con más ventas, calculada en la timezone del negocio. */
  hora_pico: { hora: number; total: number } | null;
  ajustes: Array<{
    id_ajuste: string;
    nombre: string;
    signo: "POSITIVO" | "NEGATIVO";
    monto: number;
    nota: string | null;
  }>;
  total_ajustes: number;
}

export function getCierre(idCaja: string) {
  return api.get<CierreDetalle>(`/caja/cierres/${idCaja}`);
}

/**
 * Comprobante de una transferencia ya resuelta (aprobada o rechazada). Las
 * pendientes no salen aquí: siguen en el sheet "Pagos por confirmar".
 */
export interface ComprobantePago {
  id_pago: string;
  created_at: string;
  metodo: string;
  subtipo: string | null;
  monto: number;
  propina: number;
  estado_confirmacion: "CONFIRMADO" | "RECHAZADO";
  confirmado_at: string | null;
  /** `null` si nunca hubo comprobante o si ya se purgó (ver `comprobante_purgado_at`). */
  url_comprobante: string | null;
  /** Si viene, el archivo se borró por la retención y no se puede recuperar. */
  comprobante_purgado_at: string | null;
  identificador_mesa: string;
  mesero_nombre: string | null;
  confirmado_por_nombre: string | null;
}

/**
 * El backend recorta `desde` al piso de retención y devuelve el rango que realmente
 * consultó, así que la UI puede mostrar la ventana efectiva sin recalcularla.
 */
export function listarComprobantes(input?: { desde?: string | null; hasta?: string | null }) {
  const q = new URLSearchParams();
  if (input?.desde) q.set("desde", input.desde);
  if (input?.hasta) q.set("hasta", input.hasta);
  const qs = q.toString();
  return api.get<{
    comprobantes: ComprobantePago[];
    desde: string;
    hasta: string;
    retencionDias: number;
  }>(`/caja/comprobantes${qs ? `?${qs}` : ""}`);
}
