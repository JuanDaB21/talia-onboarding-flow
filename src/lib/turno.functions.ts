import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface MiStaff {
  id_usuario: string;
  id_negocio: string;
  nombre: string;
  rol: "SUPERADMIN" | "ADMIN" | "CAJERO" | "MESERO" | "COCINA" | "BARRA" | "ESTACION";
  esta_en_turno: boolean;
  turno_iniciado_at: string | null;
  id_espacio_asignado: string | null;
  espacio_slug: string | null;
  espacio_nombre: string | null;
}

export const getMiStaff = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("usuarios_staff")
      .select(
        "id_usuario, id_negocio, nombre, rol, esta_en_turno, turno_iniciado_at, id_espacio_asignado, espacios_trabajo:id_espacio_asignado(slug, nombre)",
      )
      .eq("id_usuario", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error("Usuario no es staff");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const esp = (data as any).espacios_trabajo as { slug: string; nombre: string } | null;
    return {
      id_usuario: data.id_usuario,
      id_negocio: data.id_negocio,
      nombre: data.nombre,
      rol: data.rol as MiStaff["rol"],
      esta_en_turno: data.esta_en_turno ?? false,
      turno_iniciado_at: data.turno_iniciado_at,
      id_espacio_asignado: data.id_espacio_asignado ?? null,
      espacio_slug: esp?.slug ?? null,
      espacio_nombre: esp?.nombre ?? null,
    } satisfies MiStaff;
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
