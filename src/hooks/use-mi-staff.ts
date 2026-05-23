import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMiStaff, type MiStaff } from "@/lib/turno.functions";

export type Rol = MiStaff["rol"];

export function useMiStaff() {
  const fn = useServerFn(getMiStaff);
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["mi-staff"],
    queryFn: () => fn(),
    staleTime: 30_000,
  });

  return {
    staff: q.data ?? null,
    rol: (q.data?.rol ?? null) as Rol | null,
    enTurno: q.data?.esta_en_turno ?? false,
    turnoIniciadoAt: q.data?.turno_iniciado_at ?? null,
    loading: q.isLoading,
    refetch: q.refetch,
    invalidate: () => qc.invalidateQueries({ queryKey: ["mi-staff"] }),
  };
}
