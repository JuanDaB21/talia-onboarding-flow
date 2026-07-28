import type { ItemPreparacion } from "@/lib/preparacion.functions";

// EN_COLA ya no se produce (la preparación arranca al confirmar el pedido), pero
// pueden quedar items en cola de antes del cambio: se tratan como en preparación.
export type EstadoComanda = "EN_PREPARACION" | "LISTO" | "ENTREGADO";

export function estadoComanda(items: ItemPreparacion[]): EstadoComanda {
  if (items.length === 0) return "EN_PREPARACION";
  if (items.every((i) => i.estado_preparacion === "ENTREGADO")) return "ENTREGADO";
  if (
    items.every(
      (i) => i.estado_preparacion === "LISTO" || i.estado_preparacion === "ENTREGADO",
    )
  )
    return "LISTO";
  return "EN_PREPARACION";
}

export function minutosTranscurridos(from: string | null): number {
  if (!from) return 0;
  return (Date.now() - new Date(from).getTime()) / 60000;
}

/**
 * Base del reloj de una comanda: la CONFIRMACIÓN del mesero. `pedido_created_at`
 * no sirve — el pedido se crea al abrir la pantalla de la mesa, cuando el cliente
 * todavía está leyendo la carta. El fallback cubre pedidos previos al cambio.
 */
export function inicioComanda(c: {
  confirmado_at: string | null;
  pedido_created_at: string;
}): string {
  return c.confirmado_at ?? c.pedido_created_at;
}

export function retrasoItem(item: ItemPreparacion): number {
  const planeado = item.tiempo_planeado_min ?? 0;
  if (planeado <= 0) return 0;
  if (item.estado_preparacion === "EN_PREPARACION" || item.estado_preparacion === "EN_COLA") {
    // Items legacy en cola no tienen iniciado_at: se cronometran desde la confirmación.
    const t = minutosTranscurridos(item.iniciado_at ?? inicioComanda(item));
    return Math.max(0, Math.floor(t - planeado));
  }
  return 0;
}

export function maxRetrasoMin(items: ItemPreparacion[]): number {
  return items.reduce((acc, i) => Math.max(acc, retrasoItem(i)), 0);
}
