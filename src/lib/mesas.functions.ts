// Configuración de mesas vía REST del backend Talia (/mesas/*).
import { api } from "@/lib/api-client";
import type { Mesa } from "@/lib/mesas-schemas";

export function listarMesas() {
  return api.get<Mesa[]>("/mesas");
}

const mesaCollator = new Intl.Collator("es", { numeric: true, sensitivity: "base" });

// Ordena por identificador en orden natural (1,2,…,10 en vez de 1,10,2). No muta el arreglo.
export function ordenarMesas<T extends { identificador: string }>(mesas: T[]): T[] {
  return [...mesas].sort((a, b) => mesaCollator.compare(a.identificador, b.identificador));
}

export function crearMesa(input: { identificador: string }) {
  return api.post<Mesa>("/mesas", { identificador: input.identificador });
}

export function actualizarMesa(input: {
  id_mesa: string;
  identificador?: string;
  estado?: string;
}) {
  const { id_mesa, ...body } = input;
  return api.patch<{ ok: true }>(`/mesas/${id_mesa}`, body);
}

export function eliminarMesa(input: { id_mesa: string }) {
  return api.del<{ ok: true }>(`/mesas/${input.id_mesa}`);
}
