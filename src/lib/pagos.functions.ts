// Data-access de pagos vía REST del backend Talia. Mismas firmas/exports que el
// original (Supabase) para minimizar cambios en los componentes.
import { api } from "@/lib/api-client";

export interface ItemCobrable {
  id_item: string;
  id_pedido: string;
  nombre_producto: string;
  cantidad: number;
  precio_unitario: number;
  extras_total: number;
  subtotal: number;
  pagado: boolean;
  destino: string | null;
  estado_preparacion: string;
  pedido_numero: number;
  id_cliente: string | null;
  nombre_comensal: string | null;
}

export function listarItemsCobrables(idMesa: string) {
  return api.get<{ items: ItemCobrable[]; totalPendiente: number }>(
    `/pagos/mesas/${idMesa}/items-cobrables`,
  );
}

export interface RegistrarPagoInput {
  idMesa: string;
  metodo: "EFECTIVO" | "TRANSFERENCIA";
  subtipo?: string | null;
  voucher?: string | null;
  urlComprobante?: string | null;
  itemIds: string[];
  propina?: number;
  idBono?: string | null;
  idReserva?: string | null;
  /** Efectivo entregado por el cliente; solo para imprimir el CAMBIO en el ticket de caja. */
  montoRecibido?: number | null;
}

export function registrarPago(input: RegistrarPagoInput) {
  return api.post<{ idPago: string }>("/pagos/registrar", input);
}

export interface RegistrarPagoDivididoInput {
  idMesa: string;
  itemIds: string[];
  propina?: number;
  idBono?: string | null;
  idReserva?: string | null;
  partes: Array<{
    metodo: "EFECTIVO" | "TRANSFERENCIA";
    subtipo?: string | null;
    voucher?: string | null;
    urlComprobante?: string | null;
    monto: number;
  }>;
}

export function registrarPagoDividido(input: RegistrarPagoDivididoInput) {
  return api.post<{ idPago: string }>("/pagos/dividido", input);
}

export function cerrarMesa(idMesa: string) {
  return api.post<{ ok: true }>(`/pagos/mesas/${idMesa}/cerrar`);
}

/**
 * Cierra UN pedido individual de la mesa (lo marca PAGADO), dejando los demás abiertos.
 * Solo si todos sus ítems están cobrados. El backend imprime un ticket consolidado.
 */
export function cerrarPedido(idPedido: string) {
  return api.post<{ ok: true }>(`/pagos/pedidos/${idPedido}/cerrar`);
}

/**
 * Separa una línea de N unidades del mismo producto en N líneas de 1, para que cada
 * comensal pueda pagar la suya por separado. Rechaza líneas con adiciones (se cobran
 * juntas). Devuelve cuántas unidades quedaron.
 */
export function desglosarItem(idItem: string) {
  return api.post<{ ok: true; unidades: number }>(`/pagos/items/${idItem}/desglosar`);
}

export interface EstadoCierreMesa {
  items_pendientes: number;
  monto_pendiente: number;
  pagos_pendientes: number;
  hay_pedidos: boolean;
  puede_cerrar: boolean;
}

export function estadoCierreMesa(idMesa: string) {
  return api.get<EstadoCierreMesa>(`/pagos/mesas/${idMesa}/estado-cierre`);
}

export function confirmarPago(idPago: string, aprobar: boolean) {
  return api.post<{ ok: true }>(`/pagos/${idPago}/confirmar-transferencia`, { aprobar });
}

export interface PagoPendiente {
  id_pago: string;
  id_mesa: string;
  identificador_mesa: string;
  mesero_nombre: string | null;
  metodo: string;
  subtipo: string | null;
  /** Subtotal (sin propina en pago simple). */
  monto: number;
  /** Propina del pago (0 en las partes hijas de un dividido). */
  propina: number;
  /**
   * Monto REALMENTE transferido a conciliar contra el comprobante: en un pago simple
   * incluye la propina; en un dividido la propina ya está embebida y no se re-suma.
   */
  monto_a_confirmar: number;
  url_comprobante: string | null;
  created_at: string;
}

export function listarPagosPendientes() {
  return api.get<{ pagos: PagoPendiente[]; esAdmin: boolean }>("/pagos/pendientes");
}

export interface ResumenCaja {
  efectivo: number;
  transferencia_confirmada: number;
  transferencia_pendiente: number;
  datafono: number;
  total: number;
  propinas: number;
}

export function resumenCajaTurno() {
  return api.get<ResumenCaja>("/pagos/resumen-turno");
}
