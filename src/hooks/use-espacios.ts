import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listarEspacios, type EspacioTrabajo } from "@/lib/espacios.functions";

export type { EspacioTrabajo };

export function useEspacios(opts: { soloActivos?: boolean } = {}) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["espacios-trabajo"],
    queryFn: () => listarEspacios(),
    staleTime: 30_000,
  });
  const todos = q.data ?? [];
  const espacios = opts.soloActivos ? todos.filter((e) => e.activo) : todos;
  return {
    espacios,
    loading: q.isLoading,
    refetch: q.refetch,
    invalidate: () => qc.invalidateQueries({ queryKey: ["espacios-trabajo"] }),
  };
}
