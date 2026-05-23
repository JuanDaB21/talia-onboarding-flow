import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface MiStaff {
  id_usuario: string;
  id_negocio: string;
  nombre: string;
  rol: "SUPERADMIN" | "ADMIN" | "MESERO" | "COCINA" | "BARRA";
  esta_en_turno: boolean;
  turno_iniciado_at: string | null;
}

export const getMiStaff = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("usuarios_staff")
      .select("id_usuario, id_negocio, nombre, rol, esta_en_turno, turno_iniciado_at")
      .eq("id_usuario", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error("Usuario no es staff");
    return data as MiStaff;
  });

export const iniciarTurno = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { error } = await supabase.rpc("iniciar_turno");
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export interface MesaAbierta {
  id_mesa: string;
  identificador: string;
  estado: string;
}

export const finalizarTurno = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    // Pre-check informativo para meseros: listar mesas activas
    const { data: yo } = await supabase
      .from("usuarios_staff")
      .select("rol")
      .eq("id_usuario", userId)
      .maybeSingle();

    if (yo?.rol === "MESERO") {
      const { data: mesas } = await supabase
        .from("mesas")
        .select("id_mesa, identificador, estado")
        .eq("id_mesero_asignado", userId)
        .neq("estado", "LIBRE");
      if (mesas && mesas.length > 0) {
        const err = new Error(
          `Tienes ${mesas.length} mesa(s) con cuenta abierta: ${mesas
            .map((m) => m.identificador)
            .join(", ")}`,
        );
        throw err;
      }
    }

    const { error } = await supabase.rpc("finalizar_turno");
    if (error) throw new Error(error.message);
    return { ok: true };
  });
