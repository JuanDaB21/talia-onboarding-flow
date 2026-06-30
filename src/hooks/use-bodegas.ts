import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listarBodegas, type Bodega } from "@/lib/bodegas.functions";

export type { Bodega };

export function useBodegas(opts: { soloActivas?: boolean } = {}) {
  const fn = useServerFn(listarBodegas);
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["bodegas"],
    queryFn: () => fn(),
    staleTime: 30_000,
  });
  const todas = q.data ?? [];
  const bodegas = opts.soloActivas ? todas.filter((b) => b.activa) : todas;
  return {
    bodegas,
    loading: q.isLoading,
    refetch: q.refetch,
    invalidate: () => qc.invalidateQueries({ queryKey: ["bodegas"] }),
  };
}
