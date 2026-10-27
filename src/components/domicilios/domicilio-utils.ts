import type { Domicilio } from "@/lib/domicilios.functions";
import type { PedidoSesion } from "@/lib/servicio.functions";

export const METODO_LABEL: Record<Domicilio["metodo_pago"], string> = {
  EFECTIVO: "Efectivo",
  TRANSFERENCIA: "Transferencia",
  EN_LOCAL: "Paga en el local",
};

/** Minutos desde una fecha ISO (para el "hace X min" de las tarjetas). */
export function minutosDesde(iso: string | null, ahora: number): number {
  if (!iso) return 0;
  return Math.max(0, Math.floor((ahora - new Date(iso).getTime()) / 60_000));
}

/** Estado de cobro para mostrar en tarjeta y detalle. */
export function estadoCobro(
  d: Domicilio,
): "pagado" | "por-verificar" | "comprobante" | "pendiente" {
  if (d.pagado && !d.id_pago_pendiente) return "pagado";
  if (d.id_pago_pendiente) return "por-verificar";
  if (d.url_comprobante) return "comprobante";
  return "pendiente";
}

/** Etiqueta de la comanda impresa: código + tipo (el lugar de la "mesa"). */
export function identificadorComanda(d: Domicilio): string {
  return `${d.codigo} ${d.tipo === "DOMICILIO" ? "DOMICILIO" : "RECOGER"}`;
}

/** Adapta el domicilio al shape que imprime `imprimirComandasDePedido`. */
export function aPedidoSesion(d: Domicilio): PedidoSesion {
  return {
    id_pedido: d.id_pedido,
    estado: "CONFIRMADO",
    total: d.subtotal,
    created_at: d.created_at,
    confirmado_at: d.confirmado_at ?? new Date().toISOString(),
    entregado_at: null,
    pagado_at: null,
    seguimiento_visto_at: null,
    todos_items_pagados: d.pagado,
    estado_global: "EN_PREPARACION",
    items: d.items.map((i) => ({
      id_item: i.id_item,
      id_producto: i.id_producto ?? "",
      nombre_producto: i.nombre_producto,
      cantidad: i.cantidad,
      precio_unitario: i.precio_unitario,
      tiene_alergia: i.tiene_alergia,
      nota: i.nota,
      destino: i.destino,
      estado_preparacion: i.estado_preparacion,
      iniciado_at: null,
      listo_at: null,
      entregado_at: null,
      extras: i.extras.map((e) => ({ id_insumo_extra: "", nombre: e.nombre, precio: 0 })),
      exclusiones: i.exclusiones.map((x) => ({ id_insumo: "", nombre: x.nombre })),
      variantes: i.variantes.map((v) => ({
        id_opcion: "",
        nombre_grupo: v.nombre_grupo,
        nombre_opcion: v.nombre_opcion,
        precio_delta: 0,
      })),
    })),
  };
}

/** Agrupa líneas iguales (cada unidad es un id_item) para mostrar "2× Hamburguesa". */
export function agruparItems(d: Domicilio) {
  const m = new Map<
    string,
    { nombre: string; detalle: string; cantidad: number; subtotal: number; listos: number }
  >();
  for (const i of d.items) {
    const detalle = [
      ...i.variantes.map((v) => v.nombre_opcion),
      ...i.extras.map((e) => `+ ${e.nombre}`),
      ...i.exclusiones.map((x) => `sin ${x.nombre}`),
      i.nota ? `“${i.nota}”` : "",
    ]
      .filter(Boolean)
      .join(" · ");
    const k = `${i.nombre_producto}|${detalle}`;
    const prev = m.get(k) ?? {
      nombre: i.nombre_producto,
      detalle,
      cantidad: 0,
      subtotal: 0,
      listos: 0,
    };
    prev.cantidad += i.cantidad;
    prev.subtotal += i.cantidad * i.precio_unitario + i.extras_total;
    if (i.estado_preparacion === "LISTO" || i.estado_preparacion === "ENTREGADO")
      prev.listos += i.cantidad;
    m.set(k, prev);
  }
  return Array.from(m.values());
}
