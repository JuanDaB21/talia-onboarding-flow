/**
 * Cola en memoria de fallos de impresión, consumida por Operación en vivo.
 * No persiste entre recargas: si el usuario recarga la página, las alertas
 * pendientes se pierden pero las comandas siguen consultables desde el kanban
 * y se pueden reimprimir a mano.
 */

import type { ComandaPrintData } from "@/components/preparacion/comanda-print";

export interface PrinterAlert {
  id: string;
  slug: string; // destino UPPERCASE
  espacio_nombre: string;
  motivo: string;
  ocurrido_at: string;
  comanda: ComandaPrintData;
  reintentando: boolean;
}

type Listener = (alerts: PrinterAlert[]) => void;

let ALERTS: PrinterAlert[] = [];
const listeners = new Set<Listener>();

function emit() {
  const snapshot = ALERTS.slice();
  listeners.forEach((l) => {
    try {
      l(snapshot);
    } catch {
      /* ignore */
    }
  });
}

export function getPrinterAlerts(): PrinterAlert[] {
  return ALERTS.slice();
}

export function subscribePrinterAlerts(fn: Listener): () => void {
  listeners.add(fn);
  fn(ALERTS.slice());
  return () => {
    listeners.delete(fn);
  };
}

export function pushPrinterAlert(
  a: Omit<PrinterAlert, "id" | "ocurrido_at" | "reintentando">,
) {
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `alert-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  ALERTS = [
    ...ALERTS.filter(
      (x) => !(x.slug === a.slug && x.comanda.pedido_id === a.comanda.pedido_id),
    ),
    { ...a, id, ocurrido_at: new Date().toISOString(), reintentando: false },
  ];
  emit();
}

export function dismissPrinterAlert(id: string) {
  ALERTS = ALERTS.filter((a) => a.id !== id);
  emit();
}

export function markRetrying(id: string, value: boolean) {
  ALERTS = ALERTS.map((a) => (a.id === id ? { ...a, reintentando: value } : a));
  emit();
}
