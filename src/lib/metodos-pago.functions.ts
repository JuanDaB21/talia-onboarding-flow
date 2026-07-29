// Catálogo de métodos de pago (subtipos de transferencia) del negocio, vía REST del
// backend Talia (/metodos-pago/*). Nombres libres configurados por el admin; arranca
// vacío (sin defaults). El QR es opcional; cuando existe se sube por /storage (scope
// "qr") y se muestra por proxy priv autenticado.
import { api } from "@/lib/api-client";

export interface MetodoPago {
  id_qr: string; // el id sigue llamándose id_qr en la tabla (histórico)
  nombre: string;
  titular: string | null;
  url_qr: string | null; // key/path del objeto en storage (null = sin QR)
  orden: number;
  signed_url: string | null; // ruta proxy priv (requiere auth para verse)
}

export function listarMetodosPago() {
  return api.get<MetodoPago[]>("/metodos-pago");
}

export function guardarMetodoPago(input: {
  idQr?: string;
  nombre: string;
  titular?: string | null;
  path?: string | null;
}) {
  return api.post<{ idQr: string }>("/metodos-pago", input);
}

export function eliminarMetodoPago(input: { idQr: string }) {
  return api.del<{ ok: true }>(`/metodos-pago/${input.idQr}`);
}
