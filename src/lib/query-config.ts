/**
 * Presets centralizados de polling y caché para React Query.
 *
 * Convención de queryKeys:
 *   [<modulo>, <recurso>, ...filtros]
 *   ej: ["servicio", "mesas", negocioId]
 *       ["caja", "turno-actual"]
 *       ["dashboard", "rentabilidad", rango]
 *
 * Convención de presets:
 *   - REALTIME (10s): alertas, llamados, cosas que el usuario espera "al instante"
 *   - LIVE     (15s): vista operativa de servicio/mesas/cocina/barra
 *   - NORMAL   (30s): caja, dashboard general
 *   - SLOW     (60s): paneles del dashboard menos críticos, turno, configuración
 *
 * Todos los presets DESACTIVAN el refetch cuando la pestaña está en background
 * para evitar tráfico innecesario.
 */

type PollPreset = {
  refetchInterval: number;
  staleTime: number;
  refetchIntervalInBackground: false;
};

const make = (interval: number, stale = Math.floor(interval / 2)): PollPreset => ({
  refetchInterval: interval,
  staleTime: stale,
  refetchIntervalInBackground: false,
});

export const POLL = {
  REALTIME: make(10_000, 5_000),
  LIVE: make(15_000, 7_500),
  NORMAL: make(30_000, 15_000),
  SLOW: make(60_000, 30_000),
} as const;

/** Helper para polling condicional (ej. solo si un sheet está abierto). */
export function pollWhen(active: boolean, preset: PollPreset): PollPreset | { refetchInterval: false; staleTime: number; refetchIntervalInBackground: false } {
  if (active) return preset;
  return {
    refetchInterval: false,
    staleTime: preset.staleTime,
    refetchIntervalInBackground: false,
  };
}
