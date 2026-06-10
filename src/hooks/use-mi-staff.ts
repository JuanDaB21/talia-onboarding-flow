import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { getMiStaff, type MiStaff } from "@/lib/turno.functions";

export type Rol = MiStaff["rol"];

export function useMiStaff() {
  const fn = useServerFn(getMiStaff);
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["mi-staff"],
    queryFn: () => fn(),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const prevEnTurno = useRef<boolean | null>(null);
  useEffect(() => {
    const actual = q.data?.esta_en_turno ?? null;
    if (prevEnTurno.current === true && actual === false) {
      toast.info("Tu turno fue cerrado automáticamente (12h sin marcar salida).");
    }
    if (actual !== null) prevEnTurno.current = actual;
  }, [q.data?.esta_en_turno]);

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
