import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface Bodega {
  id_bodega: string;
  nombre: string;
  activa: boolean;
  orden: number;
  espacios_principales: { id_espacio: string; nombre: string; slug: string }[];
}

export interface InventarioPorBodegaRow {
  id_insumo: string;
  id_bodega: string;
  cantidad_actual: number;
}

export const listarBodegas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: bodegas, error } = await context.supabase
      .from("bodegas")
      .select("id_bodega, nombre, activa, orden")
      .order("orden", { ascending: true })
      .order("nombre", { ascending: true });
    if (error) throw new Error(error.message);

    const { data: ebp } = await context.supabase
      .from("espacio_bodega_principal")
      .select("id_bodega, espacios_trabajo:id_espacio(id_espacio, nombre, slug)");

    const porBodega = new Map<string, Bodega["espacios_principales"]>();
    for (const row of (ebp ?? []) as Array<{
      id_bodega: string;
      espacios_trabajo: { id_espacio: string; nombre: string; slug: string } | null;
    }>) {
      if (!row.espacios_trabajo) continue;
      const arr = porBodega.get(row.id_bodega) ?? [];
      arr.push(row.espacios_trabajo);
      porBodega.set(row.id_bodega, arr);
    }

    return ((bodegas ?? []) as Omit<Bodega, "espacios_principales">[]).map((b) => ({
      ...b,
      espacios_principales: porBodega.get(b.id_bodega) ?? [],
    })) as Bodega[];
  });

export const crearBodega = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ nombre: z.string().trim().min(2).max(60) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: neg } = await context.supabase
      .from("negocio")
      .select("id_negocio")
      .maybeSingle();
    if (!neg) throw new Error("Negocio no encontrado");
    const { data: maxRow } = await context.supabase
      .from("bodegas")
      .select("orden")
      .order("orden", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextOrden = (maxRow?.orden ?? -1) + 1;
    const { error } = await context.supabase.from("bodegas").insert({
      id_negocio: neg.id_negocio,
      nombre: data.nombre.trim(),
      activa: true,
      orden: nextOrden,
    });
    if (error) {
      if (error.code === "23505") throw new Error("Ya existe una bodega con ese nombre");
      throw new Error(error.message);
    }
    return { ok: true };
  });

export const renombrarBodega = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        id_bodega: z.string().uuid(),
        nombre: z.string().trim().min(2).max(60),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("bodegas")
      .update({ nombre: data.nombre.trim() })
      .eq("id_bodega", data.id_bodega);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const toggleBodega = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({ id_bodega: z.string().uuid(), activa: z.boolean() })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("bodegas")
      .update({ activa: data.activa })
      .eq("id_bodega", data.id_bodega);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const eliminarBodega = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ id_bodega: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("eliminar_bodega", {
      p_id_bodega: data.id_bodega,
    } as never);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setBodegaPrincipalEspacio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        id_espacio: z.string().uuid(),
        id_bodega: z.string().uuid(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("set_bodega_principal_espacio", {
      p_id_espacio: data.id_espacio,
      p_id_bodega: data.id_bodega,
    } as never);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const trasladarInventario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        id_insumo: z.string().uuid(),
        id_bodega_origen: z.string().uuid(),
        id_bodega_destino: z.string().uuid(),
        cantidad: z.coerce.number().gt(0),
        motivo: z.string().trim().min(1).max(500),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("trasladar_inventario", {
      p_id_insumo: data.id_insumo,
      p_id_bodega_origen: data.id_bodega_origen,
      p_id_bodega_destino: data.id_bodega_destino,
      p_cantidad: data.cantidad,
      p_motivo: data.motivo,
    } as never);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
