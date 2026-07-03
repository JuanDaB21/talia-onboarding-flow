import { useAuthUser } from "./use-auth-user";

/**
 * El negocio del usuario actual sale directo del JWT (`user.negocioId`), sin
 * consultar la DB: el token del backend ya lleva el tenant.
 */
export function useCurrentNegocio() {
  const { user, loading } = useAuthUser();
  return { idNegocio: user?.negocioId ?? null, loading };
}
