// Gestión de staff vía REST del backend Talia (/usuarios/*).
import { api } from "@/lib/api-client";
import type { RolStaffUi } from "@/lib/configuracion-schemas";

export interface UsuarioStaff {
  id_usuario: string;
  nombre: string;
  correo: string;
  rol: RolStaffUi | "SUPERADMIN";
  estado: "ACTIVO" | "INACTIVO" | "SUSPENDIDO";
  recibe_propinas: boolean;
  id_espacio_asignado: string | null;
  esta_en_turno: boolean;
}

export function listarUsuariosStaff() {
  return api.get<UsuarioStaff[]>("/usuarios");
}

export function crearUsuarioStaff(input: {
  nombre: string;
  correo: string;
  password: string;
  rol: RolStaffUi;
  id_espacio_asignado?: string | null;
  estado: boolean;
  recibe_propinas: boolean;
}) {
  return api.post<{ id_usuario: string }>("/usuarios", input);
}

export function actualizarUsuarioStaff(input: {
  id_usuario: string;
  nombre: string;
  rol: RolStaffUi;
  id_espacio_asignado?: string | null;
  estado: boolean;
  recibe_propinas: boolean;
  password?: string;
}) {
  const { id_usuario, ...rest } = input;
  return api.patch<{ ok: true }>(`/usuarios/${id_usuario}`, rest);
}

export function eliminarUsuarioStaff(input: { id_usuario: string }) {
  return api.del<{ ok: true }>(`/usuarios/${input.id_usuario}`);
}

export function inhabilitarStaff(input?: { id_usuario?: string }) {
  const id = input?.id_usuario;
  return id
    ? api.post<{ ok: true }>(`/usuarios/${id}/inhabilitar`)
    : api.post<{ ok: true }>("/usuarios/inhabilitar");
}

/** El mesero sale un momento (recado): sus mesas se reparten entre los meseros en turno. */
export function ausentarmeMesero() {
  return api.post<{ ok: true; reasignadas: number }>("/usuarios/ausentarme");
}

/** El mesero vuelve: recupera las mesas aún abiertas que eran suyas. */
export function retornarMesero() {
  return api.post<{ ok: true; devueltas: number }>("/usuarios/retornar");
}
