// Analítica / operación vía REST del backend Talia (/analytics/*). Solo lectura.
import { api } from "@/lib/api-client";

export interface KpisHoy {
  ventas_dia: number;
  ticket_promedio: number;
  mesas_cerradas: number;
  ocupacion_pct: number;
  mesas_totales: number;
  mesas_ocupadas: number;
  tiempo_prep_real_min: number | null;
  tiempo_prep_planeado_min: number | null;
}

export function getKpisHoy() {
  return api.get<KpisHoy>("/analytics/kpis-hoy");
}

export interface AlertaItem {
  id_item: string;
  id_mesa: string | null;
  identificador_mesa: string;
  producto: string;
  destino: string | null;
  estado_preparacion: string;
  minutos_transcurridos: number;
  minutos_planeados: number;
  retraso_min: number;
}

export function getAlertasOperacion() {
  return api.get<{ alertas: AlertaItem[] }>("/analytics/alertas");
}

export interface StaffEnTurno {
  id_usuario: string;
  nombre: string;
  rol: string;
  turno_iniciado_at: string | null;
  mesas_asignadas: number;
}

export function getPersonalEnTurno() {
  return api.get<{ staff: StaffEnTurno[] }>("/analytics/personal-turno");
}

export interface MesaOperacion {
  id_mesa: string;
  identificador: string;
  estado: string;
  mesero_nombre: string | null;
  asignada_at: string | null;
  solicitud_cliente: string | null;
  solicitud_at: string | null;
  tiene_prepedido: boolean;
}

export function getMesasOperacion() {
  return api.get<{ mesas: MesaOperacion[] }>("/analytics/mesas-operacion");
}
