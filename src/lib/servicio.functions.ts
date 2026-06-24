import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { cargarPrepedido, type PrepedidoData } from "@/lib/prepedido.functions";

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
  variantes: z
    .array(z.object({ id_opcion: z.string().uuid() }))
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
  solicitud_cliente: string | null;
  solicitud_at: string | null;
  alerta_listo: boolean;
  alerta_seguimiento: boolean;
  tiene_prepedido: boolean;
}

export const listarMesasServicio = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: yo } = await supabase
      .from("usuarios_staff")
      .select("rol")
      .eq("id_usuario", userId)
      .maybeSingle();
    const esAdmin = yo?.rol === "ADMIN" || yo?.rol === "SUPERADMIN";

    let q = supabase
      .from("mesas")
      .select(
        "id_mesa, identificador, estado, id_mesero_asignado, asignada_at, solicitud_cliente, solicitud_at",
      )
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

    const mesaIds = (mesas ?? []).map((m) => m.id_mesa);
    const listoSet = new Set<string>();
    const seguimientoSet = new Set<string>();
    const prepedidoSet = new Set<string>();

    if (mesaIds.length > 0) {
      // Mesas con items LISTO esperando recogida
      const { data: pedidosActivos } = await supabase
        .from("pedidos")
        .select("id_pedido, id_mesa, entregado_at, seguimiento_visto_at, estado")
        .in("id_mesa", mesaIds)
        .neq("estado", "PAGADO");

      const pedidoToMesa = new Map<string, string>();
      const haceMediaHora = Date.now() - 30 * 60 * 1000;
      (pedidosActivos ?? []).forEach((p) => {
        pedidoToMesa.set(p.id_pedido, p.id_mesa);
        if (
          p.entregado_at &&
          !p.seguimiento_visto_at &&
          new Date(p.entregado_at).getTime() < haceMediaHora
        ) {
          seguimientoSet.add(p.id_mesa);
        }
      });

      const pedidoIds = Array.from(pedidoToMesa.keys());
      if (pedidoIds.length > 0) {
        const { data: itemsListos } = await supabase
          .from("pedido_items")
          .select("id_pedido")
          .in("id_pedido", pedidoIds)
          .eq("estado_preparacion", "LISTO");
        (itemsListos ?? []).forEach((i) => {
          const mid = pedidoToMesa.get(i.id_pedido);
          if (mid) listoSet.add(mid);
        });
      }

      // Mesas con pre-pedido en curso (clientes armando pedido desde su celular)
      const { data: preItems } = await supabase
        .from("prepedido_items")
        .select("id_mesa")
        .in("id_mesa", mesaIds);
      (preItems ?? []).forEach((p) => prepedidoSet.add(p.id_mesa as string));
    }

    const out: MesaServicio[] = (mesas ?? []).map((m) => ({
      id_mesa: m.id_mesa,
      identificador: m.identificador,
      estado: m.estado,
      id_mesero_asignado: m.id_mesero_asignado,
      asignada_at: m.asignada_at,
      mesero_nombre: m.id_mesero_asignado ? nombres.get(m.id_mesero_asignado) ?? null : null,
      solicitud_cliente: m.solicitud_cliente,
      solicitud_at: m.solicitud_at,
      alerta_listo: listoSet.has(m.id_mesa),
      alerta_seguimiento: seguimientoSet.has(m.id_mesa),
      tiene_prepedido: prepedidoSet.has(m.id_mesa),
    }));
    return { mesas: out, esAdmin, userId };
  });

// Pre-pedido en vivo de una mesa (vista mesero/admin)
const prepedidoMesaInput = z.object({ idMesa: z.string().uuid() });
export const getPrepedidoMesa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => prepedidoMesaInput.parse(input))
  .handler(async ({ data, context }): Promise<PrepedidoData> => {
    const { supabase } = context;
    // Verificar acceso vía RLS (la mesa debe pertenecer a un negocio del usuario)
    const { data: mesa, error } = await supabase
      .from("mesas")
      .select("id_mesa")
      .eq("id_mesa", data.idMesa)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!mesa) throw new Error("Mesa no encontrada");
    return cargarPrepedido(data.idMesa);
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

    const [{ data: extras }, { data: receta }, { data: grupos }] = await Promise.all([
      supabase
        .from("extras_permitidos")
        .select("id_insumo_extra, cantidad_porcion, precio_extra, insumos:id_insumo_extra(nombre_insumo, unidad_receta)")
        .eq("id_producto", data.idProducto),
      supabase
        .from("receta_detalle")
        .select("id_insumo, cantidad, insumos:id_insumo(nombre_insumo, unidad_receta)")
        .eq("id_receta", prod.id_receta),
      supabase
        .from("producto_variante_grupos")
        .select(
          "id_grupo, nombre, seleccion, orden, producto_variante_opciones(id_opcion, id_producto_opcion, precio_delta, orden, productos:id_producto_opcion(nombre_producto))",
        )
        .eq("id_producto", data.idProducto)
        .order("orden", { ascending: true }),
    ]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const variantes = ((grupos ?? []) as any[]).map((g) => ({
      id_grupo: g.id_grupo as string,
      nombre: g.nombre as string,
      seleccion: g.seleccion as "UNICA" | "MULTIPLE",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      opciones: ((g.producto_variante_opciones ?? []) as any[])
        .sort((a, b) => Number(a.orden ?? 0) - Number(b.orden ?? 0))
        .map((o) => ({
          id_opcion: o.id_opcion as string,
          id_producto_opcion: o.id_producto_opcion as string,
          nombre_producto_opcion: (o.productos?.nombre_producto as string) ?? "—",
          precio_delta: Number(o.precio_delta ?? 0),
        })),
    }));

    return { extras: extras ?? [], ingredientes: receta ?? [], variantes };
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
      p_variantes: data.variantes,
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

// ============================================================
// Fase 6.4 — Mesa en sesión multi-pedido
// ============================================================

export interface ItemPedidoSesion {
  id_item: string;
  id_producto: string;
  nombre_producto: string;
  cantidad: number;
  precio_unitario: number;
  tiene_alergia: boolean;
  nota: string | null;
  destino: string | null;
  estado_preparacion: string;
  iniciado_at: string | null;
  listo_at: string | null;
  entregado_at: string | null;
  extras: { id_insumo_extra: string; nombre: string; precio: number }[];
  exclusiones: { id_insumo: string; nombre: string }[];
}

export interface PedidoSesion {
  id_pedido: string;
  estado: string;
  total: number;
  created_at: string;
  confirmado_at: string | null;
  entregado_at: string | null;
  pagado_at: string | null;
  seguimiento_visto_at: string | null;
  estado_global: "ABIERTO" | "EN_COLA" | "EN_PREPARACION" | "LISTO" | "ENTREGADO";
  items: ItemPedidoSesion[];
}

export interface MesaSesion {
  id_mesa: string;
  identificador: string;
  estado: string;
  id_mesero_asignado: string | null;
  mesero_nombre: string | null;
  asignada_at: string | null;
  solicitud_cliente: string | null;
  solicitud_at: string | null;
  tiempo_servicio_min: number;
  total_mesa: number;
  pedidos: PedidoSesion[];
}

function computeEstadoGlobal(
  pedidoEstado: string,
  items: { estado_preparacion: string }[],
): PedidoSesion["estado_global"] {
  if (pedidoEstado === "ABIERTO") return "ABIERTO";
  if (items.length === 0) return "EN_COLA";
  if (items.every((i) => i.estado_preparacion === "ENTREGADO")) return "ENTREGADO";
  if (items.every((i) => i.estado_preparacion === "LISTO" || i.estado_preparacion === "ENTREGADO"))
    return "LISTO";
  if (items.some((i) => i.estado_preparacion !== "EN_COLA")) return "EN_PREPARACION";
  return "EN_COLA";
}

export const obtenerMesaSesion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => idMesaInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { data: mesa, error: mErr } = await supabase
      .from("mesas")
      .select(
        "id_mesa, identificador, estado, id_mesero_asignado, asignada_at, solicitud_cliente, solicitud_at",
      )
      .eq("id_mesa", data.idMesa)
      .maybeSingle();
    if (mErr) throw new Error(mErr.message);
    if (!mesa) throw new Error("Mesa no encontrada");

    let mesero_nombre: string | null = null;
    if (mesa.id_mesero_asignado) {
      const { data: m } = await supabase
        .from("usuarios_staff")
        .select("nombre")
        .eq("id_usuario", mesa.id_mesero_asignado)
        .maybeSingle();
      mesero_nombre = m?.nombre ?? null;
    }

    // Asegurar que exista un pedido ABIERTO si no hay ninguno activo
    const { data: pedActivos } = await supabase
      .from("pedidos")
      .select("id_pedido")
      .eq("id_mesa", data.idMesa)
      .neq("estado", "PAGADO")
      .limit(1);
    if (!pedActivos || pedActivos.length === 0) {
      await supabase.rpc("crear_pedido_para_mesa", { p_id_mesa: data.idMesa });
    }

    const { data: pedidos, error: pErr } = await supabase
      .from("pedidos")
      .select(
        "id_pedido, estado, total, created_at, confirmado_at, entregado_at, pagado_at, seguimiento_visto_at",
      )
      .eq("id_mesa", data.idMesa)
      .neq("estado", "PAGADO")
      .order("created_at", { ascending: true });
    if (pErr) throw new Error(pErr.message);

    const pedidoIds = (pedidos ?? []).map((p) => p.id_pedido);

    let itemsRaw: Array<Record<string, unknown>> = [];
    let extrasRaw: Array<Record<string, unknown>> = [];
    let exclRaw: Array<Record<string, unknown>> = [];

    if (pedidoIds.length > 0) {
      const { data: it, error: iErr } = await supabase
        .from("pedido_items")
        .select(
          `id_item, id_pedido, id_producto, cantidad, precio_unitario, tiene_alergia, nota,
           destino, estado_preparacion, iniciado_at, listo_at, entregado_at, created_at,
           productos:id_producto(nombre_producto)`,
        )
        .in("id_pedido", pedidoIds)
        .order("created_at", { ascending: true });
      if (iErr) throw new Error(iErr.message);
      itemsRaw = (it ?? []) as Array<Record<string, unknown>>;

      const itemIds = itemsRaw.map((i) => i.id_item as string);
      if (itemIds.length > 0) {
        const [{ data: ex }, { data: xc }] = await Promise.all([
          supabase
            .from("pedido_item_extras")
            .select(
              "id_item, id_insumo_extra, precio_extra, insumos:id_insumo_extra(nombre_insumo)",
            )
            .in("id_item", itemIds),
          supabase
            .from("pedido_item_exclusiones")
            .select("id_item, id_insumo, insumos:id_insumo(nombre_insumo)")
            .in("id_item", itemIds),
        ]);
        extrasRaw = (ex ?? []) as Array<Record<string, unknown>>;
        exclRaw = (xc ?? []) as Array<Record<string, unknown>>;
      }
    }

    const extrasByItem = new Map<string, ItemPedidoSesion["extras"]>();
    for (const e of extrasRaw) {
      const arr = extrasByItem.get(e.id_item as string) ?? [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      arr.push({
        id_insumo_extra: e.id_insumo_extra as string,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        nombre: ((e as any).insumos?.nombre_insumo as string) ?? "—",
        precio: Number(e.precio_extra ?? 0),
      });
      extrasByItem.set(e.id_item as string, arr);
    }
    const exclByItem = new Map<string, ItemPedidoSesion["exclusiones"]>();
    for (const x of exclRaw) {
      const arr = exclByItem.get(x.id_item as string) ?? [];
      arr.push({
        id_insumo: x.id_insumo as string,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        nombre: ((x as any).insumos?.nombre_insumo as string) ?? "—",
      });
      exclByItem.set(x.id_item as string, arr);
    }

    const itemsByPedido = new Map<string, ItemPedidoSesion[]>();
    for (const i of itemsRaw) {
      const arr = itemsByPedido.get(i.id_pedido as string) ?? [];
      arr.push({
        id_item: i.id_item as string,
        id_producto: i.id_producto as string,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        nombre_producto: ((i as any).productos?.nombre_producto as string) ?? "—",
        cantidad: Number(i.cantidad),
        precio_unitario: Number(i.precio_unitario),
        tiene_alergia: Boolean(i.tiene_alergia),
        nota: (i.nota as string | null) ?? null,
        destino: (i.destino as string | null) ?? null,
        estado_preparacion: i.estado_preparacion as string,
        iniciado_at: (i.iniciado_at as string | null) ?? null,
        listo_at: (i.listo_at as string | null) ?? null,
        entregado_at: (i.entregado_at as string | null) ?? null,
        extras: extrasByItem.get(i.id_item as string) ?? [],
        exclusiones: exclByItem.get(i.id_item as string) ?? [],
      });
      itemsByPedido.set(i.id_pedido as string, arr);
    }

    // Re-fetch pedidos to include the auto-created ABIERTO if it just got created
    let pedidosFinal = pedidos ?? [];
    if ((pedidos ?? []).length === 0) {
      const { data: p2 } = await supabase
        .from("pedidos")
        .select(
          "id_pedido, estado, total, created_at, confirmado_at, entregado_at, pagado_at, seguimiento_visto_at",
        )
        .eq("id_mesa", data.idMesa)
        .neq("estado", "PAGADO")
        .order("created_at", { ascending: true });
      pedidosFinal = p2 ?? [];
    }

    const pedidosOut: PedidoSesion[] = pedidosFinal.map((p) => {
      const items = itemsByPedido.get(p.id_pedido) ?? [];
      return {
        id_pedido: p.id_pedido,
        estado: p.estado,
        total: Number(p.total ?? 0),
        created_at: p.created_at,
        confirmado_at: p.confirmado_at,
        entregado_at: p.entregado_at,
        pagado_at: p.pagado_at,
        seguimiento_visto_at: p.seguimiento_visto_at,
        estado_global: computeEstadoGlobal(p.estado, items),
        items,
      };
    });

    const total_mesa = pedidosOut.reduce((a, p) => a + p.total, 0);
    const tiempo_servicio_min = mesa.asignada_at
      ? Math.floor((Date.now() - new Date(mesa.asignada_at).getTime()) / 60000)
      : 0;

    const out: MesaSesion = {
      id_mesa: mesa.id_mesa,
      identificador: mesa.identificador,
      estado: mesa.estado,
      id_mesero_asignado: mesa.id_mesero_asignado,
      mesero_nombre,
      asignada_at: mesa.asignada_at,
      solicitud_cliente: mesa.solicitud_cliente,
      solicitud_at: mesa.solicitud_at,
      tiempo_servicio_min,
      total_mesa,
      pedidos: pedidosOut,
    };
    return out;
  });

export const editarItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => editItemSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.rpc("editar_item_pedido", {
      p_id_item: data.idItem,
      p_cantidad: data.cantidad,
      p_tiene_alergia: data.tieneAlergia,
      p_nota: data.nota ?? "",
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const iniciarNuevoPedido = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => idMesaInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: id, error } = await supabase.rpc("crear_pedido_para_mesa", {
      p_id_mesa: data.idMesa,
    });
    if (error) throw new Error(error.message);
    return { idPedido: id as string };
  });

export const marcarPedidoEntregado = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => idPedidoInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: count, error } = await supabase.rpc("marcar_pedido_entregado", {
      p_id_pedido: data.idPedido,
    });
    if (error) throw new Error(error.message);
    return { entregados: Number(count ?? 0) };
  });

export const cerrarCuentaMesa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => idMesaInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: total, error } = await supabase.rpc("cerrar_cuenta_mesa", {
      p_id_mesa: data.idMesa,
    });
    if (error) throw new Error(error.message);
    return { total: Number(total ?? 0) };
  });

export const marcarSeguimientoVisto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => idPedidoInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.rpc("marcar_seguimiento_visto", {
      p_id_pedido: data.idPedido,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const limpiarSolicitudCliente = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => idMesaInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.rpc("limpiar_solicitud_cliente", {
      p_id_mesa: data.idMesa,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Mesero atendió el llamado y va a tomar el pedido: limpia la solicitud, mantiene OCUPADA.
export const tomarPedidoLlamado = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => idMesaInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("mesas")
      .update({ solicitud_cliente: null, solicitud_at: null })
      .eq("id_mesa", data.idMesa);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Mesero detiene la alerta sin tomar pedido: libera la mesa.
// Solo aplica cuando la solicitud actual es LLAMADO (llamada inicial sin pedido).
export const detenerAlertaLlamado = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => idMesaInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: mesa, error: mErr } = await supabase
      .from("mesas")
      .select("solicitud_cliente")
      .eq("id_mesa", data.idMesa)
      .maybeSingle();
    if (mErr) throw new Error(mErr.message);
    if (!mesa) throw new Error("Mesa no encontrada");
    if (mesa.solicitud_cliente !== "LLAMADO") {
      throw new Error("La mesa ya no tiene una llamada activa");
    }
    const { error } = await supabase
      .from("mesas")
      .update({
        estado: "LIBRE",
        solicitud_cliente: null,
        solicitud_at: null,
        id_mesero_asignado: null,
        asignada_at: null,
      })
      .eq("id_mesa", data.idMesa);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Listar meseros activos del negocio (para reasignación)
export const listarMeserosNegocio = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("usuarios_staff")
      .select("id_usuario, nombre, esta_en_turno")
      .eq("rol", "MESERO")
      .eq("estado", "ACTIVO")
      .order("nombre");
    if (error) throw new Error(error.message);
    return (data ?? []).map((u) => ({
      id_usuario: u.id_usuario,
      nombre: u.nombre,
      esta_en_turno: u.esta_en_turno ?? false,
    }));
  });

// Reasignar mesero a una mesa (MESERO, ADMIN, SUPERADMIN, CAJERO)
const reasignarSchema = z.object({
  idMesa: z.string().uuid(),
  idMesero: z.string().uuid(),
});
export const reasignarMeseroMesa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => reasignarSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: yo } = await supabase
      .from("usuarios_staff")
      .select("rol, id_negocio")
      .eq("id_usuario", userId)
      .maybeSingle();
    if (!yo) throw new Error("No autorizado");
    const permitido = ["MESERO", "ADMIN", "SUPERADMIN", "CAJERO"];
    if (!permitido.includes(yo.rol)) {
      throw new Error("No tienes permiso para reasignar mesas");
    }

    const { data: nuevo, error: nErr } = await supabase
      .from("usuarios_staff")
      .select("id_usuario, rol, estado, id_negocio")
      .eq("id_usuario", data.idMesero)
      .maybeSingle();
    if (nErr) throw new Error(nErr.message);
    if (!nuevo || nuevo.rol !== "MESERO" || nuevo.estado !== "ACTIVO") {
      throw new Error("Mesero inválido");
    }
    if (nuevo.id_negocio !== yo.id_negocio) {
      throw new Error("Mesero de otro negocio");
    }

    const { error } = await supabase
      .from("mesas")
      .update({ id_mesero_asignado: data.idMesero, asignada_at: new Date().toISOString() })
      .eq("id_mesa", data.idMesa);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

