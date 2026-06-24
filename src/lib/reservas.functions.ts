import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  ESTADOS_RESERVA,
  reservaCrearSchema,
  type EstadoReserva,
} from "./reservas.schemas";

export interface Reserva {
  id_reserva: string;
  codigo_reserva: string;
  customer_name: string;
  customer_phone: string | null;
  fecha_reserva: string;
  hora_reserva: string;
  cantidad_personas: number;
  tipo_reserva: string | null;
  monto_abonado: number;
  estado: EstadoReserva;
  id_pedido_aplicado: string | null;
  created_at: string;
}

const listarSchema = z.object({
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  estado: z.enum(ESTADOS_RESERVA).optional(),
  search: z.string().trim().max(80).optional(),
});

export const listarReservas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => listarSchema.parse(i ?? {}))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let q = supabase
      .from("reservas")
      .select(
        "id_reserva, codigo_reserva, customer_name, customer_phone, fecha_reserva, hora_reserva, cantidad_personas, tipo_reserva, monto_abonado, estado, id_pedido_aplicado, created_at",
      )
      .order("fecha_reserva", { ascending: true })
      .order("hora_reserva", { ascending: true });
    if (data.fecha) q = q.eq("fecha_reserva", data.fecha);
    if (data.estado) q = q.eq("estado", data.estado);
    if (data.search) {
      const s = data.search.replace(/[%_]/g, "");
      q = q.or(`codigo_reserva.ilike.%${s}%,customer_name.ilike.%${s}%`);
    }
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r) => ({
      ...r,
      monto_abonado: Number(r.monto_abonado),
    })) as Reserva[];
  });

export const getMetricasReservasHoy = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const hoy = new Date().toISOString().slice(0, 10);
    const { data, error } = await supabase
      .from("reservas")
      .select("estado, monto_abonado")
      .eq("fecha_reserva", hoy);
    if (error) throw new Error(error.message);
    const out = {
      total: 0,
      abonado: 0,
      devuelto: 0,
      retenido: 0,
    };
    for (const r of data ?? []) {
      out.total += 1;
      const m = Number(r.monto_abonado);
      if (r.estado === "abonado" || r.estado === "asistida") out.abonado += m;
      else if (r.estado === "cancelada_devuelto") out.devuelto += m;
      else if (r.estado === "cancelada_retenido") out.retenido += m;
    }
    return out;
  });

export const crearReserva = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => reservaCrearSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: yo } = await supabase
      .from("usuarios_staff")
      .select("id_negocio")
      .eq("id_usuario", userId)
      .maybeSingle();
    if (!yo?.id_negocio) throw new Error("Usuario sin negocio");
    const { data: row, error } = await supabase
      .from("reservas")
      // codigo_reserva lo genera un trigger BEFORE INSERT
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .insert({
        id_negocio: yo.id_negocio,
        customer_name: data.customer_name,
        customer_phone: data.customer_phone || null,
        fecha_reserva: data.fecha_reserva,
        hora_reserva: data.hora_reserva,
        cantidad_personas: data.cantidad_personas,
        tipo_reserva: data.tipo_reserva || null,
        estado: data.estado,
        monto_abonado: data.monto_abonado,
        created_by: userId,
      } as any)
      .select("id_reserva, codigo_reserva")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

const actualizarSchema = reservaCrearSchema.innerType().partial().extend({
  id_reserva: z.string().uuid(),
});

export const actualizarReserva = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => actualizarSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { id_reserva, ...patch } = data;
    const clean: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(patch)) {
      if (v !== undefined) clean[k] = v;
    }
    const { error } = await supabase
      .from("reservas")
      .update(clean)
      .eq("id_reserva", id_reserva);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const cancelarSchema = z.object({
  id_reserva: z.string().uuid(),
  devolver: z.boolean(),
});

export const cancelarReserva = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => cancelarSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const nuevo = data.devolver ? "cancelada_devuelto" : "cancelada_retenido";
    const { error } = await supabase
      .from("reservas")
      .update({ estado: nuevo })
      .eq("id_reserva", data.id_reserva);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const eliminarReserva = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id_reserva: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("reservas")
      .delete()
      .eq("id_reserva", data.id_reserva);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export interface ReservaAplicable {
  id_reserva: string;
  codigo_reserva: string;
  customer_name: string;
  monto_abonado: number;
}

export const listarReservasAplicablesHoy = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const hoy = new Date().toISOString().slice(0, 10);
    const { data, error } = await context.supabase
      .from("reservas")
      .select("id_reserva, codigo_reserva, customer_name, monto_abonado")
      .eq("fecha_reserva", hoy)
      .eq("estado", "abonado")
      .order("hora_reserva", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => ({
      ...r,
      monto_abonado: Number(r.monto_abonado),
    })) as ReservaAplicable[];
  });

const aplicarSchema = z.object({
  idReserva: z.string().uuid(),
  idMesa: z.string().uuid(),
  itemIds: z.array(z.string().uuid()).min(1).max(200),
});

export const aplicarAbonoEnCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => aplicarSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { data: id, error } = await context.supabase.rpc(
      "pagar_con_abono_reserva",
      {
        p_id_reserva: data.idReserva,
        p_id_mesa: data.idMesa,
        p_item_ids: data.itemIds,
      },
    );
    if (error) throw new Error(error.message);
    return { idPago: id as string };
  });
