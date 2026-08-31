// Módulo Clientes vía REST del backend Talia (/clientes/*). Directorio derivado de las
// reservas, agrupado por número de teléfono. Solo lectura.
import { api } from "@/lib/api-client";
import type { EstadoReserva } from "./reservas.schemas";

export interface Cliente {
  telefono: string;
  nombre: string;
  veces_reservado: number;
  /** Fecha de la última reserva (YYYY-MM-DD). */
  ultima_reserva: string | null;
  /** Suma de todos los abonos registrados en sus reservas. */
  total_abonado: number;
}

export interface ClienteReserva {
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
  created_at: string;
}

export function listarClientes(params?: { search?: string }) {
  const qs = new URLSearchParams();
  if (params?.search) qs.set("search", params.search);
  const suffix = qs.toString() ? `?${qs}` : "";
  return api.get<Cliente[]>(`/clientes${suffix}`);
}

export function listarReservasDeCliente(telefono: string) {
  return api.get<ClienteReserva[]>(`/clientes/${encodeURIComponent(telefono)}/reservas`);
}
