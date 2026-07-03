// Verificación de correo disponible para el registro, vía REST (backend Talia).
import { api } from "@/lib/api-client";

export function checkCorreoDisponible(correo: string) {
  const c = correo.trim().toLowerCase();
  return api.get<{ disponible: boolean }>(
    `/auth/correo-disponible?correo=${encodeURIComponent(c)}`,
    { auth: false },
  );
}
