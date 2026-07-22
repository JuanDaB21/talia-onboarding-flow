// Config de impresión por espacio + cola de impresión (print_jobs) + gestión de
// print-agents, vía REST del backend Talia (/impresion).
import { api } from "@/lib/api-client";
import type { ComandaPrintData } from "@/components/preparacion/comanda-print";

export interface ImpresionConfig {
  id_espacio: string;
  requiere_impresora: boolean;
  ancho_papel_mm: number;
  codepage: string;
}

export function getImpresionConfigs() {
  return api.get<ImpresionConfig[]>("/impresion");
}

export function guardarImpresionConfig(input: {
  id_espacio: string;
  ancho_papel_mm: 58 | 80;
  codepage?: string;
  requiere_impresora?: boolean;
}) {
  return api.post<{ ok: true }>("/impresion", input);
}

// Compat: firma anterior (solo ancho).
export function guardarImpresionAncho(input: { id_espacio: string; ancho_papel_mm: 58 | 80 }) {
  return guardarImpresionConfig(input);
}

/**
 * Encola las comandas para que las imprima el print-agent local (una por estación).
 * Reemplaza el dispatch por WebUSB en el navegador.
 */
export function enqueueComandas(comandas: ComandaPrintData[]) {
  return api.post<{ ok: true; encolados: number; agenteConectado: boolean }>("/impresion/jobs", {
    jobs: comandas.map((c) => ({ espacio_slug: c.destino, comanda: c })),
  });
}

/**
 * Imprime la precuenta completa de la mesa en la impresora del espacio CAJA.
 * El backend arma los items desde la DB; aquí solo viaja el preview no persistido
 * (propina elegida y descuentos bono/reserva en pantalla).
 */
export function imprimirCuenta(
  idMesa: string,
  extras: {
    propina?: number | null;
    descuentos?: { etiqueta: string; monto: number }[];
  } = {},
) {
  return api.post<{ ok: true; encolado: boolean; agenteConectado: boolean }>(
    `/impresion/cuenta/${idMesa}`,
    extras,
  );
}

/**
 * Imprime el reporte de un cierre de caja en la impresora del espacio CAJA.
 * Reemplaza el window.print() del navegador: el agente lo renderiza en ESC/POS
 * con el mismo ancho y codepage que la precuenta y el ticket de pago.
 */
export function imprimirCierre(idCaja: string) {
  return api.post<{ ok: true; encolado: boolean; agenteConectado: boolean }>(
    `/impresion/cierre/${idCaja}`,
  );
}

export interface PrintJob {
  id_job: string;
  espacio_slug: string;
  estado: "PENDIENTE" | "IMPRESO" | "ERROR";
  error: string | null;
  created_at: string;
  printed_at: string | null;
}

export function listarPrintJobs(limit = 30) {
  return api.get<PrintJob[]>(`/impresion/jobs?limit=${limit}`);
}

export function reintentarPrintJob(idJob: string) {
  return api.post<{ ok: true; agenteConectado: boolean }>(`/impresion/jobs/${idJob}/reintentar`);
}

export interface PrintAgent {
  id_agente: string;
  nombre: string;
  last_seen_at: string | null;
  conectado: boolean;
}

export function listarPrintAgents() {
  return api.get<PrintAgent[]>("/impresion/agents");
}

export function crearPrintAgent(nombre: string) {
  return api.post<{ id_agente: string; nombre: string; token: string }>("/impresion/agents", {
    nombre,
  });
}

export function eliminarPrintAgent(idAgente: string) {
  return api.del<{ ok: true }>(`/impresion/agents/${idAgente}`);
}
