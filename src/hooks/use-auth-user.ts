import { useEffect, useSyncExternalStore } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

/**
 * Sesión de usuario compartida entre TODOS los componentes.
 * Una sola llamada a `supabase.auth.getUser()` por carga de la app +
 * suscripción a `onAuthStateChange`. Sustituye los 4 useEffect duplicados
 * que disparaban un fetch por cada mount.
 */

type State = {
  user: User | null;
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

function init() {
  if (initialized) return;
  initialized = true;

  // Lectura inicial
  supabase.auth.getUser().then(({ data }) => {
    setState({ user: data.user ?? null, loading: false });
  }).catch(() => {
    setState({ user: null, loading: false });
  });

  // Mantenerse sincronizado con cambios de auth (login/logout/refresh)
  supabase.auth.onAuthStateChange((_event, session) => {
    setState({ user: session?.user ?? null, loading: false });
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
  // Asegura inicialización incluso si la suscripción ocurre después
  useEffect(() => {
    init();
  }, []);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
