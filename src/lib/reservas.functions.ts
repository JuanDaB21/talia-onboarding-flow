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
}

export function listarReservas(params?: { fecha?: string; estado?: string; search?: string }) {
  const qs = new URLSearchParams();
  if (params?.fecha) qs.set("fecha", params.fecha);
  if (params?.estado) qs.set("estado", params.estado);
  if (params?.search) qs.set("search", params.search);
  const suffix = qs.toString() ? `?${qs}` : "";
  return api.get<Reserva[]>(`/reservas${suffix}`);
}

export function getMetricasReservasHoy() {
  return api.get<{ total: number; abonado: number; devuelto: number; retenido: number }>(
    "/reservas/metricas-hoy",
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

// Aplica el abono de una reserva sobre items seleccionados de una mesa (checkout).
// (pagar_con_abono_reserva en el backend → POST /reservas/pagar-con-abono)
export function aplicarAbonoEnCheckout(input: {
  idReserva: string;
  idMesa: string;
  itemIds: string[];
}) {
  return api.post<{ idPago: string }>("/reservas/pagar-con-abono", input);
}
