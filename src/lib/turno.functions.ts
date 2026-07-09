// Turno + contexto de staff vía REST (backend Talia). Mismas firmas que la
// versión Supabase para no tocar los componentes que las consumen.
import { api } from "@/lib/api-client";

export interface MiStaff {
  id_usuario: string;
  id_negocio: string;
  nombre: string;
  rol: "SUPERADMIN" | "ADMIN" | "CAJERO" | "MESERO" | "COCINA" | "BARRA" | "ESTACION";
  esta_en_turno: boolean;
  turno_iniciado_at: string | null;
  ausente_desde: string | null;
  id_espacio_asignado: string | null;
  espacio_slug: string | null;
  espacio_nombre: string | null;
}

export function getMiStaff() {
  return api.get<MiStaff>("/turno/mi-staff");
}

export function iniciarTurno() {
  return api.post<{ ok: true }>("/turno/iniciar");
}

export interface MesaAbierta {
  id_mesa: string;
  identificador: string;
  estado: string;
}

export function finalizarTurno() {
  // El backend (finalizar_turno) valida mesas abiertas para meseros y devuelve
  // el error correspondiente; aquí solo disparamos la acción.
  return api.post<{ ok: true }>("/turno/finalizar");
}

export function calcularPropinas(desde: string, hasta: string) {
  return api.get<{ filas: Array<Record<string, unknown>> }>(
    `/turno/propinas?desde=${encodeURIComponent(desde)}&hasta=${encodeURIComponent(hasta)}`,
  );
}
