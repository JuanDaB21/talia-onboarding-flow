/**
 * Printing Bridge Service
 *
 * Async, fire-and-forget print dispatch hooked into the "Confirmar Pedido"
 * flow. Failures are swallowed (logged) so the restaurant operation never
 * stops if the external Printing API is down or not yet configured.
 */

/** Zona de impresión. Acepta cualquier slug de espacio de trabajo (en minúsculas). */
export type PrintZone = string;

const PRINT_API_URL =
  (import.meta.env.VITE_PRINT_API_URL as string | undefined) ||
  "https://api.talia-printing-placeholder.local";

export interface PrintItem {
  nombre_producto: string;
  cantidad: number;
  notas_preparacion: string | null;
  extras: { nombre: string; precio: number }[];
}

export interface PrintPayload {
  id_pedido: string;
  mesa_nombre_identificador: string;
  mesero_nombre: string | null;
  timestamp: string;
  items: PrintItem[];
}

export async function sendPrintJob(
  payload: PrintPayload,
  zone: PrintZone,
): Promise<{ ok: boolean }> {
  try {
    const res = await fetch(`${PRINT_API_URL}/print/${zone}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return { ok: true };
  } catch (err) {
    // Placeholder mode / network failure — log structured payload and continue.
    // eslint-disable-next-line no-console
    console.log(`[printService] (${zone}) placeholder payload`, {
      zone,
      payload,
      error: err instanceof Error ? err.message : String(err),
    });
    return { ok: false };
  }
}

interface DispatchItem {
  destino: string | null;
  nombre_producto: string;
  cantidad: number;
  nota: string | null;
  exclusiones: { nombre: string }[];
  extras: { nombre: string; precio: number }[];
  variantes: { nombre_grupo: string; nombre_opcion: string }[];
}

function buildNotas(it: DispatchItem): string | null {
  const partes: string[] = [];
  if (it.variantes.length > 0) {
    partes.push(
      it.variantes
        .map((v) => `Con ${v.nombre_grupo}: ${v.nombre_opcion}`)
        .join(" | "),
    );
  }
  if (it.exclusiones.length > 0) {
    partes.push(`Sin: ${it.exclusiones.map((e) => e.nombre).join(", ")}`);
  }
  if (it.nota && it.nota.trim()) partes.push(it.nota.trim());
  return partes.length > 0 ? partes.join(" · ") : null;
}

function toPrintItem(it: DispatchItem): PrintItem {
  return {
    nombre_producto: it.nombre_producto,
    cantidad: it.cantidad,
    notas_preparacion: buildNotas(it),
    extras: it.extras.map((e) => ({ nombre: e.nombre, precio: e.precio })),
  };
}

export async function dispatchPrintJobsForPedido(input: {
  idPedido: string;
  mesaIdentificador: string;
  meseroNombre: string | null;
  items: DispatchItem[];
}): Promise<void> {
  // Agrupar items por destino (cualquier slug de espacio de trabajo)
  const grupos = new Map<string, DispatchItem[]>();
  input.items.forEach((i) => {
    const d = (i.destino ?? "COCINA").toUpperCase();
    const arr = grupos.get(d) ?? [];
    arr.push(i);
    grupos.set(d, arr);
  });

  const timestamp = new Date().toISOString();
  const base = {
    id_pedido: input.idPedido,
    mesa_nombre_identificador: input.mesaIdentificador,
    mesero_nombre: input.meseroNombre,
    timestamp,
  };

  const jobs: Promise<{ ok: boolean }>[] = [];
  grupos.forEach((items, destino) => {
    if (items.length === 0) return;
    jobs.push(sendPrintJob({ ...base, items: items.map(toPrintItem) }, destino.toLowerCase()));
  });

  if (jobs.length === 0) return;
  await Promise.allSettled(jobs);
}
