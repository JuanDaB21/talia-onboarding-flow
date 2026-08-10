// Reservas vía REST del backend Talia (/reservas/*).
import { api } from "@/lib/api-client";
import type { EstadoReserva } from "./reservas.schemas";

export interface Reserva {
  id_reserva: string;
  codigo_reserva: string;
  customer_name: string;
  customer_phone: string | null;
  fecha_reserva: string;
  hora_reserva: string;
  cantidad_personas: number;
  tipo_reserva: string | null;
  monto_abonado: number;
  estado: EstadoReserva;
  id_pedido_aplicado: string | null;
  id_metodo_pago_qr: string | null;
  metodo_pago_label: string | null;
  created_at: string;
  id_decoracion: string | null;
  /** Snapshot del costo al reservar; no cambia si luego sube el precio del catálogo. */
  costo_decoracion: number;
  decoracion_nombre: string | null;
  /** Mesa donde se sentó la reserva (null mientras no se haya sentado). */
  id_mesa_asignada: string | null;
  /** Línea de la cuenta donde se cargó la decoración. */
  id_item_decoracion: string | null;
}

export interface ReservaInput {
  customer_name: string;
  customer_phone?: string | null;
  fecha_reserva: string;
  hora_reserva: string;
  cantidad_personas: number;
  tipo_reserva?: string | null;
  estado?: EstadoReserva;
  monto_abonado?: number;
  id_metodo_pago_qr?: string | null;
  id_decoracion?: string | null;
  costo_decoracion?: number;
}

export function listarReservas(params?: { fecha?: string; estado?: string; search?: string }) {
  const qs = new URLSearchParams();
  if (params?.fecha) qs.set("fecha", params.fecha);
  if (params?.estado) qs.set("estado", params.estado);
  if (params?.search) qs.set("search", params.search);
  const suffix = qs.toString() ? `?${qs}` : "";
  return api.get<Reserva[]>(`/reservas${suffix}`);
}

export function getMetricasReservasHoy(params?: { fecha?: string }) {
  const suffix = params?.fecha ? `?fecha=${encodeURIComponent(params.fecha)}` : "";
  return api.get<{ total: number; abonado: number; devuelto: number; retenido: number }>(
    `/reservas/metricas-hoy${suffix}`,
  );
}

export interface ReservaAplicable {
  id_reserva: string;
  codigo_reserva: string;
  customer_name: string;
  monto_abonado: number;
}

export function listarReservasAplicablesHoy() {
  return api.get<ReservaAplicable[]>("/reservas/aplicables-hoy");
}

export function crearReserva(input: ReservaInput) {
  return api.post<{ id_reserva: string; codigo_reserva: string }>("/reservas", input);
}

export function actualizarReserva(idReserva: string, patch: Partial<ReservaInput>) {
  return api.patch<{ ok: true }>(`/reservas/${idReserva}`, patch);
}

export function cancelarReserva(idReserva: string, devolver: boolean) {
  return api.post<{ ok: true }>(`/reservas/${idReserva}/cancelar`, { devolver });
}

export function eliminarReserva(idReserva: string) {
  return api.del<{ ok: true }>(`/reservas/${idReserva}`);
}

/** Reserva del día operativo que todavía no se ha sentado en ninguna mesa. */
export interface ReservaSentable {
  id_reserva: string;
  codigo_reserva: string;
  customer_name: string;
  hora_reserva: string;
  cantidad_personas: number;
  tipo_reserva: string | null;
  monto_abonado: number;
  costo_decoracion: number;
  decoracion_nombre: string | null;
}

export function listarReservasSentablesHoy() {
  return api.get<ReservaSentable[]>("/reservas/sentables-hoy");
}

/**
 * Vincula la reserva a una mesa y carga su decoración como ítem de la cuenta.
 * Idempotente: repetirlo no duplica el ítem. El abono se sigue descontando al
 * cobrar, no aquí.
 */
export function sentarReserva(idReserva: string, idMesa: string) {
  return api.post<{
    id_pedido: string;
    id_item_decoracion: string | null;
    decoracion_nombre: string | null;
    costo_decoracion: number;
    monto_abonado: number;
    codigo_reserva: string;
  }>(`/reservas/${idReserva}/sentar`, { idMesa });
}

// Aplica el abono de una reserva sobre items seleccionados de una mesa (checkout).
// (pagar_con_abono_reserva en el backend → POST /reservas/pagar-con-abono)
export function aplicarAbonoEnCheckout(input: {
  idReserva: string;
  idMesa: string;
  itemIds: string[];
}) {
  return api.post<{ idPago: string }>("/reservas/pagar-con-abono", input);
}
