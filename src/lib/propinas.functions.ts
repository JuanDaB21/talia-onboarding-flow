import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface PropinaUsuario {
  id_usuario: string;
  nombre: string;
  rol: string;
  dias_activos: number;
  total_propinas: number;
}

export const getPropinasPorUsuario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        desde: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        hasta: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase.rpc(
      "calcular_propinas_por_usuario",
      { _desde: data.desde, _hasta: data.hasta },
    );
    if (error) throw new Error(error.message);
    return {
      filas: (rows ?? []).map((r: {
        id_usuario: string;
        nombre: string;
        rol: string;
        dias_activos: number;
        total_propinas: number | string;
      }) => ({
        id_usuario: r.id_usuario,
        nombre: r.nombre,
        rol: r.rol,
        dias_activos: Number(r.dias_activos),
        total_propinas: Number(r.total_propinas),
      })) as PropinaUsuario[],
    };
  });
