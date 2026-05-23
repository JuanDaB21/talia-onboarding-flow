import type { ItemPreparacion } from "@/lib/preparacion.functions";

export type EstadoComanda = "EN_COLA" | "EN_PREPARACION" | "LISTO" | "ENTREGADO";

export function estadoComanda(items: ItemPreparacion[]): EstadoComanda {
  if (items.length === 0) return "EN_COLA";
  if (items.every((i) => i.estado_preparacion === "ENTREGADO")) return "ENTREGADO";
  if (
    items.every(
      (i) => i.estado_preparacion === "LISTO" || i.estado_preparacion === "ENTREGADO",
    )
  )
    return "LISTO";
  if (items.some((i) => i.estado_preparacion !== "EN_COLA")) return "EN_PREPARACION";
  return "EN_COLA";
}

export function minutosTranscurridos(from: string | null): number {
  if (!from) return 0;
  return (Date.now() - new Date(from).getTime()) / 60000;
}

export function retrasoItem(item: ItemPreparacion): number {
  const planeado = item.tiempo_planeado_min ?? 0;
  if (planeado <= 0) return 0;
  if (item.estado_preparacion === "EN_PREPARACION") {
    const t = minutosTranscurridos(item.iniciado_at);
    return Math.max(0, Math.floor(t - planeado));
  }
  return 0;
}

export function maxRetrasoMin(items: ItemPreparacion[]): number {
  return items.reduce((acc, i) => Math.max(acc, retrasoItem(i)), 0);
}
