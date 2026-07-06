// Propinas por usuario vía REST del backend Talia (/propinas/*).
import { api } from "@/lib/api-client";

export interface PropinaUsuario {
  id_usuario: string;
  nombre: string;
  rol: string;
  dias_activos: number;
  total_propinas: number;
}

export function getPropinasPorUsuario(input: { desde: string; hasta: string }) {
  const qs = new URLSearchParams({ desde: input.desde, hasta: input.hasta });
  return api.get<{ filas: PropinaUsuario[] }>(`/propinas/por-usuario?${qs}`);
}
