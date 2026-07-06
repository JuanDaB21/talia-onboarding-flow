// Espacios de trabajo vía REST del backend Talia (/espacios/*).
import { api } from "@/lib/api-client";

export interface EspacioTrabajo {
  id_espacio: string;
  nombre: string;
  slug: string;
  activo: boolean;
  es_sistema: boolean;
  orden: number;
}

export function listarEspacios() {
  return api.get<EspacioTrabajo[]>("/espacios");
}

export function crearEspacio(input: { nombre: string }) {
  return api.post<EspacioTrabajo>("/espacios", { nombre: input.nombre });
}

export function renombrarEspacio(input: { id_espacio: string; nombre: string }) {
  return api.patch<{ ok: true }>(`/espacios/${input.id_espacio}`, { nombre: input.nombre });
}

export function toggleEspacio(input: { id_espacio: string; activo: boolean }) {
  return api.patch<{ ok: true }>(`/espacios/${input.id_espacio}`, { activo: input.activo });
}

export function eliminarEspacio(input: { id_espacio: string }) {
  return api.del<{ ok: true }>(`/espacios/${input.id_espacio}`);
}
