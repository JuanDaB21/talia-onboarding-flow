// Data-access de consulta de tickets de pago vía REST del backend Talia (/tickets/*).
// La reimpresión NO vive aquí: se reutiliza `imprimirCopiaTicket` de impresion.functions.
import { api } from "@/lib/api-client";

/** Fila de listado/búsqueda. `anio` solo viene en la búsqueda por número. */
export interface TicketRow {
  id_pago: string;
  numero_ticket: number;
  created_at: string;
  mesa_identificador: string;
  mesero: string | null;
  metodo: string;
  subtipo: string | null;
  monto: number;
  propina: number;
  /** monto + propina en pago simple; en dividido la propina ya está embebida en las partes. */
  total: number;
  estado_confirmacion: "CONFIRMADO" | "PENDIENTE" | "RECHAZADO";
  dividido: boolean;
  anio?: number;
}

/** Una tender del pago (efectivo/transferencia/…), tal como se imprime en el desglose. */
export interface PartePago {
  metodo: string;
  subtipo: string | null;
  monto: number;
  pendiente: boolean;
}

/** Línea del ticket. `detalle` son extras/exclusiones/variantes ya renderizados como texto. */
export interface ItemTicket {
  cantidad: number;
  nombre_producto: string;
  subtotal: number;
  detalle: string[];
}

/**
 * Ficha completa del ticket: el MISMO shape que arma el papel (`armarTicketPago` del backend),
 * para que lo que se ve en pantalla sea literalmente lo que se imprime.
 * `recibido`/`cambio` llegan null: el efectivo entregado no se persiste, solo se usa al imprimir
 * el ticket original. La UI omite esas filas cuando son null (no muestra "$0").
 */
export interface TicketDetalle {
  id_pago: string;
  numero_ticket: number | null;
  mesa_identificador: string;
  fecha: string;
  mesero: string | null;
  items: ItemTicket[];
  subtotal: number;
  descuento: number;
  propina: number;
  total: number;
  partes: PartePago[];
  recibido: number | null;
  cambio: number | null;
}

/**
 * Tickets de un DÍA OPERATIVO. Sin `fecha`, el día operativo actual (el backend devuelve el que
 * realmente consultó). No es el día de calendario: una jornada que cruza medianoche va completa.
 */
export function listarTickets(input?: { fecha?: string | null }) {
  const q = new URLSearchParams();
  if (input?.fecha) q.set("fecha", input.fecha);
  const qs = q.toString();
  return api.get<{ tickets: TicketRow[]; fecha: string }>(`/tickets${qs ? `?${qs}` : ""}`);
}

/**
 * Busca por consecutivo. El número reinicia cada 1-ene y no es único entre años, así que puede
 * devolver varias coincidencias (la más reciente primero), cada una con su `anio`.
 * Sin resultados ⇒ lista vacía, no error.
 */
export function buscarTicket(numero: number) {
  return api.get<{ coincidencias: TicketRow[] }>(`/tickets/buscar?numero=${numero}`);
}

export function getTicket(idPago: string) {
  return api.get<{ ticket: TicketDetalle }>(`/tickets/${idPago}`);
}
