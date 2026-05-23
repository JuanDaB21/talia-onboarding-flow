import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const idMesaInput = z.object({ idMesa: z.string().uuid() });
const idPedidoInput = z.object({ idPedido: z.string().uuid() });
const idItemInput = z.object({ idItem: z.string().uuid() });

const editItemSchema = z.object({
  idItem: z.string().uuid(),
  cantidad: z.number().positive().max(999),
  tieneAlergia: z.boolean(),
  nota: z.string().max(500).optional().nullable(),
});

const addItemSchema = z.object({
  idPedido: z.string().uuid(),
  idProducto: z.string().uuid(),

  idProducto: z.string().uuid(),
  cantidad: z.number().positive().max(999),
  tieneAlergia: z.boolean(),
  nota: z.string().max(500).optional().nullable(),
  extras: z
    .array(z.object({ id_insumo_extra: z.string().uuid() }))
    .max(20)
    .default([]),
  exclusiones: z
    .array(z.object({ id_insumo: z.string().uuid() }))
    .max(20)
    .default([]),
});

export interface MesaServicio {
  id_mesa: string;
  identificador: string;
  estado: string;
  id_mesero_asignado: string | null;
  asignada_at: string | null;
  mesero_nombre: string | null;
}

export const listarMesasServicio = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    // ¿usuario es admin?
    const { data: yo } = await supabase
      .from("usuarios_staff")
      .select("rol")
      .eq("id_usuario", userId)
      .maybeSingle();
    const esAdmin = yo?.rol === "ADMIN" || yo?.rol === "SUPERADMIN";

    let q = supabase
      .from("mesas")
      .select("id_mesa, identificador, estado, id_mesero_asignado, asignada_at")
      .order("identificador");
    if (!esAdmin) {
      q = q.eq("id_mesero_asignado", userId);
    }
    const { data: mesas, error } = await q;
    if (error) throw new Error(error.message);

    const meseroIds = Array.from(
      new Set((mesas ?? []).map((m) => m.id_mesero_asignado).filter(Boolean) as string[]),
    );
    const nombres = new Map<string, string>();
    if (meseroIds.length > 0) {
      const { data: ms } = await supabase
        .from("usuarios_staff")
        .select("id_usuario, nombre")
        .in("id_usuario", meseroIds);
      (ms ?? []).forEach((m) => nombres.set(m.id_usuario, m.nombre));
    }

    const out: MesaServicio[] = (mesas ?? []).map((m) => ({
      id_mesa: m.id_mesa,
      identificador: m.identificador,
      estado: m.estado,
      id_mesero_asignado: m.id_mesero_asignado,
      asignada_at: m.asignada_at,
      mesero_nombre: m.id_mesero_asignado ? nombres.get(m.id_mesero_asignado) ?? null : null,
    }));
    return { mesas: out, esAdmin, userId };
  });

export const obtenerMesaPedido = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => idMesaInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { data: mesa, error: meErr } = await supabase
      .from("mesas")
      .select("id_mesa, identificador, estado, id_mesero_asignado, id_negocio")
      .eq("id_mesa", data.idMesa)
      .maybeSingle();
    if (meErr) throw new Error(meErr.message);
    if (!mesa) throw new Error("Mesa no encontrada");

    const { data: pedidoId, error: rpcErr } = await supabase.rpc("crear_pedido_para_mesa", {
      p_id_mesa: data.idMesa,
    });
    if (rpcErr) throw new Error(rpcErr.message);

    const { data: pedido } = await supabase
      .from("pedidos")
      .select("id_pedido, estado, total, id_mesero")
      .eq("id_pedido", pedidoId as string)
      .single();

    const { data: items } = await supabase
      .from("pedido_items")
      .select(
        "id_item, id_producto, cantidad, precio_unitario, tiene_alergia, nota, destino, productos:id_producto(nombre_producto)",
      )
      .eq("id_pedido", pedidoId as string)
      .order("created_at");

    const itemIds = (items ?? []).map((i) => i.id_item);
    const [{ data: extras }, { data: excl }] = await Promise.all([
      itemIds.length
        ? supabase
            .from("pedido_item_extras")
            .select("id_item, id_insumo_extra, cantidad_porcion, precio_extra, insumos:id_insumo_extra(nombre_insumo)")
            .in("id_item", itemIds)
        : Promise.resolve({ data: [] as never[] }),
      itemIds.length
        ? supabase
            .from("pedido_item_exclusiones")
            .select("id_item, id_insumo, insumos:id_insumo(nombre_insumo)")
            .in("id_item", itemIds)
        : Promise.resolve({ data: [] as never[] }),
    ]);

    return { mesa, pedido, items: items ?? [], extras: extras ?? [], exclusiones: excl ?? [] };
  });

export const getCatalogoServicio = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data: productos, error } = await supabase
      .from("productos")
      .select(
        "id_producto, nombre_producto, descripcion_producto, precio_venta, url_imagen, id_receta, receta_master:id_receta(id_categoria, categorias:id_categoria(id_categoria, nombre, destino))",
      )
      .eq("activo", true)
      .order("nombre_producto");
    if (error) throw new Error(error.message);

    const cats = new Map<string, { id_categoria: string; nombre: string; destino: string }>();
    const out = (productos ?? [])
      .map((p) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rm: any = (p as any).receta_master;
        const c = rm?.categorias;
        if (!c?.id_categoria) return null;
        cats.set(c.id_categoria, { id_categoria: c.id_categoria, nombre: c.nombre, destino: c.destino });
        return {
          id_producto: p.id_producto,
          nombre_producto: p.nombre_producto,
          descripcion_producto: p.descripcion_producto,
          precio_venta: Number(p.precio_venta),
          url_imagen: p.url_imagen,
          id_categoria: c.id_categoria,
          id_receta: p.id_receta,
        };
      })
      .filter(Boolean) as Array<{
      id_producto: string;
      nombre_producto: string;
      descripcion_producto: string | null;
      precio_venta: number;
      url_imagen: string | null;
      id_categoria: string;
      id_receta: string;
    }>;

    return {
      productos: out,
      categorias: Array.from(cats.values()).sort((a, b) => a.nombre.localeCompare(b.nombre)),
    };
  });

export const getOpcionesProducto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ idProducto: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: prod } = await supabase
      .from("productos")
      .select("id_producto, id_receta")
      .eq("id_producto", data.idProducto)
      .single();
    if (!prod) throw new Error("Producto no encontrado");

    const [{ data: extras }, { data: receta }] = await Promise.all([
      supabase
        .from("extras_permitidos")
        .select("id_insumo_extra, cantidad_porcion, precio_extra, insumos:id_insumo_extra(nombre_insumo, unidad_receta)")
        .eq("id_producto", data.idProducto),
      supabase
        .from("receta_detalle")
        .select("id_insumo, cantidad, insumos:id_insumo(nombre_insumo, unidad_receta)")
        .eq("id_receta", prod.id_receta),
    ]);

    return { extras: extras ?? [], ingredientes: receta ?? [] };
  });

export const agregarItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => addItemSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.rpc("agregar_item_pedido", {
      p_id_pedido: data.idPedido,
      p_id_producto: data.idProducto,
      p_cantidad: data.cantidad,
      p_tiene_alergia: data.tieneAlergia,
      p_nota: data.nota ?? "",
      p_extras: data.extras,
      p_exclusiones: data.exclusiones,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const eliminarItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => idItemInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.rpc("eliminar_item_pedido", { p_id_item: data.idItem });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const confirmarPedido = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => idPedidoInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.rpc("confirmar_pedido", { p_id_pedido: data.idPedido });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
