// Analítica avanzada vía REST del backend Talia (/analytics/*).
// El backend devuelve el mismo shape que estas interfaces (POST { desde, hasta }).
import { api } from "@/lib/api-client";

export interface DateRange {
  desde: string;
  hasta: string;
}

// ============================================================
// 1. INGENIERÍA DEL MENÚ
// ============================================================
export type Cuadrante = "STAR" | "PLOWHORSE" | "PUZZLE" | "DOG";

export interface ProductoMenu {
  id_producto: string;
  nombre: string;
  unidades: number;
  precio: number;
  costo: number;
  margen_unit: number;
  margen_pct: number;
  ingresos: number;
  cuadrante: Cuadrante;
}

export interface IngenieriaMenu {
  productos: ProductoMenu[];
  food_cost_pct: number;
  margen_promedio_pct: number;
  ingresos_totales: number;
  costo_total: number;
  conteo_por_cuadrante: Record<Cuadrante, number>;
}

export function getIngenieriaMenu(range: DateRange) {
  return api.post<IngenieriaMenu>("/analytics/ingenieria-menu", range);
}

// ============================================================
// 2. COMPORTAMIENTO DEL CLIENTE
// ============================================================
export interface ComportamientoCliente {
  heatmap: number[][]; // [dia][hora] = $ pagos
  ticket_promedio_mesa: number;
  mesas_cerradas: number;
  ventas_totales: number;
  upselling_pct: number;
  pedidos_totales: number;
  pedidos_con_extras: number;
}

export function getComportamientoCliente(range: DateRange) {
  return api.post<ComportamientoCliente>("/analytics/comportamiento-cliente", range);
}

// ============================================================
// 3. EFICIENCIA OPERATIVA
// ============================================================
export interface ProductoLento {
  id_producto: string;
  nombre: string;
  destino: string | null;
  tiempo_real_prom: number;
  tiempo_planeado_prom: number;
  desviacion_min: number;
  muestras: number;
}
export interface MeseroPerf {
  id_usuario: string;
  nombre: string;
  mesas_atendidas: number;
  tiempo_resp_prom_min: number | null;
  total_vendido: number;
}
export interface EficienciaOperativa {
  ciclo_mesa_prom_min: number | null;
  ciclo_mesa_muestras: number;
  productos_lentos: ProductoLento[];
  meseros: MeseroPerf[];
}

export function getEficienciaOperativa(range: DateRange) {
  return api.post<EficienciaOperativa>("/analytics/eficiencia-operativa", range);
}

// ============================================================
// 4. ALERTAS Y FUGAS
// ============================================================
export interface DesviacionInsumo {
  id_insumo: string;
  nombre: string;
  teorico: number;
  real: number;
  diferencia: number;
  diferencia_pct: number;
}
export interface AlertasFugas {
  items_cancelados: number;
  cuello_botella: number;
  cuello_umbral: number;
  desviaciones: DesviacionInsumo[];
}

export function getAlertasFugas(range: DateRange) {
  return api.post<AlertasFugas>("/analytics/alertas-fugas", range);
}
