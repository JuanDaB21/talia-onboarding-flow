// Catálogo de decoraciones de reserva vía REST del backend Talia (/decoraciones/*).
import { api } from "@/lib/api-client";

export interface Decoracion {
  id_decoracion: string;
  nombre: string;
  costo: number;
  activo: boolean;
  created_at: string;
}

export function listarDecoraciones(opts?: { incluirInactivas?: boolean }) {
  const qs = opts?.incluirInactivas ? "?incluirInactivas=true" : "";
  return api.get<Decoracion[]>(`/decoraciones${qs}`);
}

/** Devuelve la fila creada para poder autoseleccionarla en el formulario. */
export function crearDecoracion(input: { nombre: string; costo: number }) {
  return api.post<Decoracion>("/decoraciones", input);
}

export function actualizarDecoracion(
  idDecoracion: string,
  input: { nombre?: string; costo?: number; activo?: boolean },
) {
  return api.patch<{ ok: true }>(`/decoraciones/${idDecoracion}`, input);
}

/** Si la decoración ya se usó en alguna reserva, el backend la desactiva en vez de borrarla. */
export function eliminarDecoracion(idDecoracion: string) {
  return api.del<{ ok: true; desactivada: boolean }>(`/decoraciones/${idDecoracion}`);
}
