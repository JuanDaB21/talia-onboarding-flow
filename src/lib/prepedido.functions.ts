import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ============================================================
// Tipos públicos
// ============================================================

export interface PrepedidoSesion {
  id_sesion: string;
  id_cliente: string;
  nombre: string;
  created_at: string;
  last_seen_at: string;
}

export interface PrepedidoExtra {
  id_insumo_extra: string;
  nombre: string;
  precio: number;
}

export interface PrepedidoExclusion {
  id_insumo: string;
  nombre: string;
}

export interface PrepedidoItem {
  id_prepedido_item: string;
  id_sesion: string;
  id_cliente: string;
  nombre_cliente: string;
  id_producto: string;
  nombre_producto: string;
  cantidad: number;
  precio_unitario: number;
  tiene_alergia: boolean;
  nota: string | null;
  extras: PrepedidoExtra[];
  exclusiones: PrepedidoExclusion[];
  subtotal: number;
  created_at: string;
}

export interface PrepedidoData {
  sesiones: PrepedidoSesion[];
  items: PrepedidoItem[];
  total: number;
}

// ============================================================
// Schemas
// ============================================================

const uuid = z.string().uuid();

const unirseSchema = z.object({
  idMesa: uuid,
  idCliente: uuid,
  nombre: z.string().trim().min(1).max(40),
});

const agregarSchema = z.object({
  idMesa: uuid,
  idSesion: uuid,
  idCliente: uuid,
  idProducto: uuid,
  cantidad: z.number().int().min(1).max(50),
  tieneAlergia: z.boolean().optional().default(false),
  nota: z.string().max(300).optional().nullable(),
  extras: z.array(z.object({ id_insumo_extra: uuid })).default([]),
  exclusiones: z.array(z.object({ id_insumo: uuid })).default([]),
});

const editarSchema = z.object({
  idItem: uuid,
  idCliente: uuid,
  cantidad: z.number().int().min(1).max(50),
  tieneAlergia: z.boolean().optional().default(false),
  nota: z.string().max(300).optional().nullable(),
  extras: z.array(z.object({ id_insumo_extra: uuid })).default([]),
  exclusiones: z.array(z.object({ id_insumo: uuid })).default([]),
});

const eliminarSchema = z.object({
  idItem: uuid,
  idCliente: uuid,
});

const idMesaSchema = z.object({ idMesa: uuid });

// ============================================================
// Helpers
// ============================================================

export async function cargarPrepedido(idMesa: string): Promise<PrepedidoData> {
  const { data: sesionesRaw, error: sErr } = await supabaseAdmin
    .from("prepedido_sesiones")
    .select("id_sesion, id_cliente, nombre, created_at, last_seen_at")
    .eq("id_mesa", idMesa)
    .order("created_at", { ascending: true });
  if (sErr) throw new Error(sErr.message);

  const { data: itemsRaw, error: iErr } = await supabaseAdmin
    .from("prepedido_items")
    .select(
      "id_prepedido_item, id_sesion, id_producto, cantidad, precio_unitario, tiene_alergia, nota, extras, exclusiones, created_at, productos:id_producto(nombre_producto)",
    )
    .eq("id_mesa", idMesa)
    .order("created_at", { ascending: true });
  if (iErr) throw new Error(iErr.message);

  const sesiones: PrepedidoSesion[] = (sesionesRaw ?? []).map((s) => ({
    id_sesion: s.id_sesion as string,
    id_cliente: s.id_cliente as string,
    nombre: s.nombre as string,
    created_at: s.created_at as string,
    last_seen_at: s.last_seen_at as string,
  }));
  const sesionMap = new Map(sesiones.map((s) => [s.id_sesion, s]));

  // Resolver nombres de insumos para extras/exclusiones
  const insumoIds = new Set<string>();
  for (const it of itemsRaw ?? []) {
    const extras = (it.extras as Array<{ id_insumo_extra?: string }>) ?? [];
    const exclus = (it.exclusiones as Array<{ id_insumo?: string }>) ?? [];
    for (const e of extras) if (e.id_insumo_extra) insumoIds.add(e.id_insumo_extra);
    for (const x of exclus) if (x.id_insumo) insumoIds.add(x.id_insumo);
  }
  const insumoNombres = new Map<string, string>();
  if (insumoIds.size > 0) {
    const { data: ins } = await supabaseAdmin
      .from("insumos")
      .select("id_insumo, nombre_insumo")
      .in("id_insumo", Array.from(insumoIds));
    (ins ?? []).forEach((i) =>
      insumoNombres.set(i.id_insumo as string, i.nombre_insumo as string),
    );
  }

  // Precios de extras para subtotal y rendering
  const productoExtras = new Map<string, Map<string, number>>();
  const productosUnicos = Array.from(
    new Set((itemsRaw ?? []).map((i) => i.id_producto as string)),
  );
  if (productosUnicos.length > 0) {
    const { data: ex } = await supabaseAdmin
      .from("extras_permitidos")
      .select("id_producto, id_insumo_extra, precio_extra")
      .in("id_producto", productosUnicos);
    for (const row of ex ?? []) {
      const pid = row.id_producto as string;
      const m = productoExtras.get(pid) ?? new Map<string, number>();
      m.set(row.id_insumo_extra as string, Number(row.precio_extra));
      productoExtras.set(pid, m);
    }
  }

  let total = 0;
  const items: PrepedidoItem[] = (itemsRaw ?? []).map((i) => {
    const ses = sesionMap.get(i.id_sesion as string);
    const extrasRaw = (i.extras as Array<{ id_insumo_extra: string }>) ?? [];
    const exclusRaw = (i.exclusiones as Array<{ id_insumo: string }>) ?? [];
    const pid = i.id_producto as string;
    const precios = productoExtras.get(pid) ?? new Map<string, number>();
    const extras: PrepedidoExtra[] = extrasRaw.map((e) => ({
      id_insumo_extra: e.id_insumo_extra,
      nombre: insumoNombres.get(e.id_insumo_extra) ?? "—",
      precio: precios.get(e.id_insumo_extra) ?? 0,
    }));
    const exclusiones: PrepedidoExclusion[] = exclusRaw.map((x) => ({
      id_insumo: x.id_insumo,
      nombre: insumoNombres.get(x.id_insumo) ?? "—",
    }));
    const cantidad = Number(i.cantidad);
    const precio = Number(i.precio_unitario);
    const extrasSum = extras.reduce((a, e) => a + e.precio, 0);
    const subtotal = (precio + extrasSum) * cantidad;
    total += subtotal;
    return {
      id_prepedido_item: i.id_prepedido_item as string,
      id_sesion: i.id_sesion as string,
      id_cliente: ses?.id_cliente ?? "",
      nombre_cliente: ses?.nombre ?? "—",
      id_producto: pid,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      nombre_producto: ((i as any).productos?.nombre_producto as string) ?? "—",
      cantidad,
      precio_unitario: precio,
      tiene_alergia: !!i.tiene_alergia,
      nota: (i.nota as string | null) ?? null,
      extras,
      exclusiones,
      subtotal,
      created_at: i.created_at as string,
    };
  });

  return { sesiones, items, total };
}

async function asegurarMesa(idMesa: string): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from("mesas")
    .select("id_mesa, id_negocio")
    .eq("id_mesa", idMesa)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Mesa no encontrada");
  return data.id_negocio as string;
}

async function getSesionPropia(idMesa: string, idCliente: string, idSesion?: string) {
  let q = supabaseAdmin
    .from("prepedido_sesiones")
    .select("id_sesion, id_cliente, id_mesa")
    .eq("id_mesa", idMesa)
    .eq("id_cliente", idCliente);
  if (idSesion) q = q.eq("id_sesion", idSesion);
  const { data, error } = await q.maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Sesión no encontrada");
  return data;
}

async function getPrecioProducto(idProducto: string, idNegocio: string): Promise<number> {
  const { data, error } = await supabaseAdmin
    .from("productos")
    .select("precio_venta, activo, id_negocio")
    .eq("id_producto", idProducto)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || !data.activo || data.id_negocio !== idNegocio) {
    throw new Error("Producto inválido");
  }
  return Number(data.precio_venta);
}

async function validarExtrasYExclusiones(
  idProducto: string,
  extras: Array<{ id_insumo_extra: string }>,
  exclusiones: Array<{ id_insumo: string }>,
) {
  if (extras.length > 0) {
    const ids = extras.map((e) => e.id_insumo_extra);
    const { data } = await supabaseAdmin
      .from("extras_permitidos")
      .select("id_insumo_extra")
      .eq("id_producto", idProducto)
      .in("id_insumo_extra", ids);
    const ok = new Set((data ?? []).map((d) => d.id_insumo_extra as string));
    for (const e of extras) {
      if (!ok.has(e.id_insumo_extra)) throw new Error("Extra no permitido");
    }
  }
  if (exclusiones.length > 0) {
    const { data: prod } = await supabaseAdmin
      .from("productos")
      .select("id_receta")
      .eq("id_producto", idProducto)
      .maybeSingle();
    if (!prod) throw new Error("Producto inválido");
    const ids = exclusiones.map((e) => e.id_insumo);
    const { data } = await supabaseAdmin
      .from("receta_detalle")
      .select("id_insumo")
      .eq("id_receta", prod.id_receta as string)
      .in("id_insumo", ids);
    const ok = new Set((data ?? []).map((d) => d.id_insumo as string));
    for (const x of exclusiones) {
      if (!ok.has(x.id_insumo)) throw new Error("Exclusión no válida");
    }
  }
}

// ============================================================
// Server fns públicas (clientes en la mesa)
// ============================================================

export const unirseSesionPrepedido = createServerFn({ method: "POST" })
  .inputValidator((input) => unirseSchema.parse(input))
  .handler(async ({ data }) => {
    await asegurarMesa(data.idMesa);
    const { error } = await supabaseAdmin
      .from("prepedido_sesiones")
      .upsert(
        {
          id_mesa: data.idMesa,
          id_cliente: data.idCliente,
          nombre: data.nombre.trim(),
          last_seen_at: new Date().toISOString(),
        },
        { onConflict: "id_mesa,id_cliente" },
      );
    if (error) throw new Error(error.message);
    const { data: ses } = await supabaseAdmin
      .from("prepedido_sesiones")
      .select("id_sesion, id_cliente, nombre")
      .eq("id_mesa", data.idMesa)
      .eq("id_cliente", data.idCliente)
      .single();
    return { id_sesion: ses!.id_sesion as string };
  });

export const getPrepedidoPublico = createServerFn({ method: "POST" })
  .inputValidator((input) => idMesaSchema.parse(input))
  .handler(async ({ data }) => {
    await asegurarMesa(data.idMesa);
    return cargarPrepedido(data.idMesa);
  });

export const agregarItemPrepedido = createServerFn({ method: "POST" })
  .inputValidator((input) => agregarSchema.parse(input))
  .handler(async ({ data }) => {
    const idNegocio = await asegurarMesa(data.idMesa);
    await getSesionPropia(data.idMesa, data.idCliente, data.idSesion);
    const precio = await getPrecioProducto(data.idProducto, idNegocio);
    await validarExtrasYExclusiones(data.idProducto, data.extras, data.exclusiones);

    const { error } = await supabaseAdmin.from("prepedido_items").insert({
      id_mesa: data.idMesa,
      id_sesion: data.idSesion,
      id_producto: data.idProducto,
      cantidad: data.cantidad,
      precio_unitario: precio,
      tiene_alergia: !!data.tieneAlergia,
      nota: data.nota?.trim() || null,
      extras: data.extras,
      exclusiones: data.exclusiones,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const editarItemPrepedido = createServerFn({ method: "POST" })
  .inputValidator((input) => editarSchema.parse(input))
  .handler(async ({ data }) => {
    const { data: item, error } = await supabaseAdmin
      .from("prepedido_items")
      .select("id_prepedido_item, id_mesa, id_sesion, id_producto")
      .eq("id_prepedido_item", data.idItem)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!item) throw new Error("Item no encontrado");

    await getSesionPropia(item.id_mesa as string, data.idCliente, item.id_sesion as string);
    await validarExtrasYExclusiones(
      item.id_producto as string,
      data.extras,
      data.exclusiones,
    );

    const { error: uErr } = await supabaseAdmin
      .from("prepedido_items")
      .update({
        cantidad: data.cantidad,
        tiene_alergia: !!data.tieneAlergia,
        nota: data.nota?.trim() || null,
        extras: data.extras,
        exclusiones: data.exclusiones,
      })
      .eq("id_prepedido_item", data.idItem);
    if (uErr) throw new Error(uErr.message);
    return { ok: true };
  });

export const eliminarItemPrepedido = createServerFn({ method: "POST" })
  .inputValidator((input) => eliminarSchema.parse(input))
  .handler(async ({ data }) => {
    const { data: item, error } = await supabaseAdmin
      .from("prepedido_items")
      .select("id_prepedido_item, id_mesa, id_sesion")
      .eq("id_prepedido_item", data.idItem)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!item) return { ok: true };
    await getSesionPropia(item.id_mesa as string, data.idCliente, item.id_sesion as string);
    const { error: dErr } = await supabaseAdmin
      .from("prepedido_items")
      .delete()
      .eq("id_prepedido_item", data.idItem);
    if (dErr) throw new Error(dErr.message);
    return { ok: true };
  });

// Opciones del producto para el editor del cliente (sin auth)
export const getOpcionesProductoPublico = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({ idMesa: uuid, idProducto: uuid }).parse(input),
  )
  .handler(async ({ data }) => {
    const idNegocio = await asegurarMesa(data.idMesa);
    const { data: prod } = await supabaseAdmin
      .from("productos")
      .select("id_producto, id_receta, id_negocio")
      .eq("id_producto", data.idProducto)
      .maybeSingle();
    if (!prod || prod.id_negocio !== idNegocio) {
      throw new Error("Producto no encontrado");
    }
    const [{ data: extras }, { data: receta }] = await Promise.all([
      supabaseAdmin
        .from("extras_permitidos")
        .select(
          "id_insumo_extra, cantidad_porcion, precio_extra, insumos:id_insumo_extra(nombre_insumo, unidad_receta)",
        )
        .eq("id_producto", data.idProducto),
      supabaseAdmin
        .from("receta_detalle")
        .select("id_insumo, cantidad, insumos:id_insumo(nombre_insumo, unidad_receta)")
        .eq("id_receta", prod.id_receta as string),
    ]);
    return { extras: extras ?? [], ingredientes: receta ?? [] };
  });

// ============================================================
// Server fns autenticadas (staff)
// ============================================================

export const aceptarPrepedido = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => idMesaSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: count, error } = await supabase.rpc("aceptar_prepedido_mesa", {
      p_id_mesa: data.idMesa,
    });
    if (error) throw new Error(error.message);
    return { aceptados: Number(count ?? 0) };
  });
