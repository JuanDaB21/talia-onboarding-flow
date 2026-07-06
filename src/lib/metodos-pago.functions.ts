// Métodos de pago QR vía REST del backend Talia (/metodos-pago/*).
// El QR se sube por /storage (scope "qr") y se muestra por proxy priv autenticado.
import { api } from "@/lib/api-client";

export const PLATAFORMAS = ["Nequi", "Daviplata", "Bancolombia", "Otra"] as const;
export type Plataforma = (typeof PLATAFORMAS)[number];

export interface MetodoPagoQr {
  id_qr: string;
  plataforma: Plataforma;
  etiqueta: string | null;
  titular: string | null;
  url_qr: string; // key/path del objeto en storage
  signed_url: string | null; // ruta proxy priv (requiere auth para verse)
}

export function listarMetodosPagoQr() {
  return api.get<MetodoPagoQr[]>("/metodos-pago");
}

export function guardarMetodoPagoQr(input: {
  idQr?: string;
  plataforma: Plataforma;
  etiqueta?: string | null;
  titular?: string | null;
  path: string;
}) {
  return api.post<{ idQr: string }>("/metodos-pago", input);
}

export function eliminarMetodoPagoQr(input: { idQr: string }) {
  return api.del<{ ok: true }>(`/metodos-pago/${input.idQr}`);
}
