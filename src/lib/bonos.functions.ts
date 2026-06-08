import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface Bono {
  id_bono: string;
  nombre: string;
  porcentaje: number;
  activo: boolean;
  created_at: string;
}

export interface BonoAplicacion {
  id_aplicacion: string;
  id_bono: string | null;
  id_pago: string;
  id_mesa: string | null;
  id_mesero: string | null;
  mesero_nombre: string | null;
  identificador_mesa: string | null;
  nombre_bono: string;
  porcentaje_aplicado: number;
  subtotal_items: number;
  monto_descuento: number;
  monto_descuento_neto: number;
  created_at: string;
}

const crearSchema = z.object({
  nombre: z.string().min(1).max(80),
  porcentaje: z.number().min(0.01).max(100),
});

const actualizarSchema = z.object({
  idBono: z.string().uuid(),
  nombre: z.string().min(1).max(80),
  porcentaje: z.number().min(0.01).max(100),
  activo: z.boolean(),
});

const idBonoSchema = z.object({ idBono: z.string().uuid() });

const previewSchema = z.object({
  idBono: z.string().uuid(),
  itemIds: z.array(z.string().uuid()).min(1).max(200),
});

const historialSchema = z.object({
  desde: z.string().datetime().optional().nullable(),
  hasta: z.string().datetime().optional().nullable(),
  idMesero: z.string().uuid().optional().nullable(),
});

async function esAdmin(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("usuarios_staff")
    .select("rol")
    .eq("id_usuario", userId)
    .maybeSingle();
  return data?.rol === "ADMIN" || data?.rol === "SUPERADMIN";
}

export const listarBonos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const admin = await esAdmin(supabase, userId);
    let q = supabase
      .from("bonos")
      .select("id_bono, nombre, porcentaje, activo, created_at")
      .order("created_at", { ascending: false });
    if (!admin) q = q.eq("activo", true);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return {
      esAdmin: admin,
      bonos: (data ?? []).map((b) => ({
        id_bono: b.id_bono,
        nombre: b.nombre,
        porcentaje: Number(b.porcentaje),
        activo: b.activo,
        created_at: b.created_at,
      })) as Bono[],
    };
  });

export const crearBono = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => crearSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: staff } = await supabase
      .from("usuarios_staff")
      .select("id_negocio")
      .eq("id_usuario", userId)
      .maybeSingle();
    if (!staff?.id_negocio) throw new Error("Sin negocio");
    const { data: row, error } = await supabase
      .from("bonos")
      .insert({
        id_negocio: staff.id_negocio,
        nombre: data.nombre.trim(),
        porcentaje: data.porcentaje,
      })
      .select("id_bono")
      .single();
    if (error) throw new Error(error.message);
    return { idBono: row.id_bono as string };
  });

export const actualizarBono = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => actualizarSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("bonos")
      .update({
        nombre: data.nombre.trim(),
        porcentaje: data.porcentaje,
        activo: data.activo,
      })
      .eq("id_bono", data.idBono);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const eliminarBono = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => idBonoSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    // Soft delete
    const { error } = await supabase
      .from("bonos")
      .update({ activo: false })
      .eq("id_bono", data.idBono);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const previsualizarBono = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => previewSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: bono, error: bErr } = await supabase
      .from("bonos")
      .select("nombre, porcentaje, activo")
      .eq("id_bono", data.idBono)
      .maybeSingle();
    if (bErr) throw new Error(bErr.message);
    if (!bono || !bono.activo) throw new Error("Bono no disponible");

    const { data: costos, error: cErr } = await supabase.rpc(
      "calcular_costo_items",
      { p_item_ids: data.itemIds },
    );
    if (cErr) throw new Error(cErr.message);
    const precio = Number(
      (costos as { precio_total?: number } | null)?.precio_total ?? 0,
    );
    const costo = Number(
      (costos as { costo_total?: number } | null)?.costo_total ?? 0,
    );
    const porcentaje = Number(bono.porcentaje);
    const descuento = Math.min(precio, Math.round((precio * porcentaje) / 100));
    const margen = precio > 0 ? Math.max(0, (precio - costo) / precio) : 0;
    const neto = Math.round(descuento * margen);
    return {
      nombre: bono.nombre as string,
      porcentaje,
      descuento,
      descuento_neto: neto,
      subtotal: precio,
    };
  });

export const historialBonos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => historialSchema.parse(input ?? {}))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const admin = await esAdmin(supabase, userId);
    if (!admin) {
      return {
        aplicaciones: [] as BonoAplicacion[],
        total_regalado: 0,
        total_neto: 0,
        total_aplicaciones: 0,
        meseros: [] as { id: string; nombre: string }[],
        esAdmin: false,
      };
    }
    let q = supabase
      .from("bono_aplicaciones")
      .select(
        "id_aplicacion, id_bono, id_pago, id_mesa, id_mesero, nombre_bono, porcentaje_aplicado, subtotal_items, monto_descuento, monto_descuento_neto, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(500);
    if (data.desde) q = q.gte("created_at", data.desde);
    if (data.hasta) q = q.lte("created_at", data.hasta);
    if (data.idMesero) q = q.eq("id_mesero", data.idMesero);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const meseroIds = Array.from(
      new Set(
        (rows ?? []).map((r) => r.id_mesero).filter(Boolean) as string[],
      ),
    );
    const mesaIds = Array.from(
      new Set((rows ?? []).map((r) => r.id_mesa).filter(Boolean) as string[]),
    );
    const meserosMap = new Map<string, string>();
    const mesasMap = new Map<string, string>();
    if (meseroIds.length) {
      const { data: ms } = await supabase
        .from("usuarios_staff")
        .select("id_usuario, nombre")
        .in("id_usuario", meseroIds);
      (ms ?? []).forEach((m) => meserosMap.set(m.id_usuario, m.nombre));
    }
    if (mesaIds.length) {
      const { data: ms } = await supabase
        .from("mesas")
        .select("id_mesa, identificador")
        .in("id_mesa", mesaIds);
      (ms ?? []).forEach((m) => mesasMap.set(m.id_mesa, m.identificador));
    }

    // Lista de meseros (para filtro): todos los meseros del negocio
    const { data: allMeseros } = await supabase
      .from("usuarios_staff")
      .select("id_usuario, nombre")
      .eq("rol", "MESERO")
      .order("nombre", { ascending: true });

    const aplicaciones: BonoAplicacion[] = (rows ?? []).map((r) => ({
      id_aplicacion: r.id_aplicacion,
      id_bono: r.id_bono,
      id_pago: r.id_pago,
      id_mesa: r.id_mesa,
      id_mesero: r.id_mesero,
      mesero_nombre: r.id_mesero ? meserosMap.get(r.id_mesero) ?? null : null,
      identificador_mesa: r.id_mesa ? mesasMap.get(r.id_mesa) ?? null : null,
      nombre_bono: r.nombre_bono,
      porcentaje_aplicado: Number(r.porcentaje_aplicado),
      subtotal_items: Number(r.subtotal_items),
      monto_descuento: Number(r.monto_descuento),
      monto_descuento_neto: Number(r.monto_descuento_neto),
      created_at: r.created_at,
    }));

    return {
      aplicaciones,
      total_regalado: aplicaciones.reduce((a, b) => a + b.monto_descuento, 0),
      total_neto: aplicaciones.reduce(
        (a, b) => a + b.monto_descuento_neto,
        0,
      ),
      total_aplicaciones: aplicaciones.length,
      meseros: (allMeseros ?? []).map((m) => ({
        id: m.id_usuario,
        nombre: m.nombre,
      })),
      esAdmin: true,
    };
  });
