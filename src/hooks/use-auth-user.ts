import { useEffect, useSyncExternalStore } from "react";
import { getMe, currentTokens, type AuthUser } from "@/lib/auth";
import { onAuthExpired } from "@/lib/api-client";

/**
 * Sesión de usuario compartida entre TODOS los componentes, basada en el JWT
 * propio del backend (no Supabase). Una sola hidratación por carga de la app
 * (`getMe()` si hay tokens) + escucha de `onAuthExpired` para limpiar al vencer.
 * `login`/`register`/`logout` empujan el estado con `setAuthUser` sin recargar.
 */

type State = {
  user: AuthUser | null;
  loading: boolean;
};

let state: State = { user: null, loading: true };
let initialized = false;
const listeners = new Set<() => void>();

function setState(next: State) {
  if (next.user === state.user && next.loading === state.loading) return;
  state = next;
  listeners.forEach((l) => l());
}

/** Actualiza la sesión tras login/register (user) o logout (null). */
export function setAuthUser(user: AuthUser | null) {
  setState({ user, loading: false });
}

function init() {
  if (initialized) return;
  initialized = true;

  if (!currentTokens()) {
    setState({ user: null, loading: false });
    return;
  }

  getMe()
    .then((u) => setState({ user: u, loading: false }))
    .catch(() => setState({ user: null, loading: false }));

  // Si el refresh falla, api-client dispara "expired": limpiamos la sesión.
  onAuthExpired.addEventListener("expired", () => {
    setState({ user: null, loading: false });
  });
}

function subscribe(listener: () => void) {
  init();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): State {
  return state;
}

export function useAuthUser(): State {
  useEffect(() => {
    init();
  }, []);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
