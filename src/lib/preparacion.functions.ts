import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const destinoSchema = z.object({ destino: z.enum(["COCINA", "BARRA"]) });
const avanzarSchema = z.object({
  idItem: z.string().uuid(),
  nuevoEstado: z.enum(["EN_PREPARACION", "LISTO"]),
});
const iniciarComandaSchema = z.object({
  idPedido: z.string().uuid(),
  destino: z.enum(["COCINA", "BARRA"]),
});

export interface ItemPreparacion {
  id_item: string;
  id_pedido: string;
  id_producto: string;
  nombre_producto: string;
  nombre_subcategoria: string | null;
  cantidad: number;
  tiene_alergia: boolean;
  nota: string | null;
  destino: string;
  estado_preparacion: string;
  tiempo_planeado_min: number | null;
  iniciado_at: string | null;
  listo_at: string | null;
  entregado_at: string | null;
  pedido_created_at: string;
  mesa_identificador: string;
  extras: { nombre: string; cantidad: number }[];
  exclusiones: { nombre: string }[];
  variantes: { nombre_grupo: string; nombre_opcion: string }[];
}

export interface ComandaEstacion {
  id_pedido: string;
  mesa_identificador: string;
  pedido_created_at: string;
  mesero_nombre: string | null;
  items: ItemPreparacion[];
}


export const listarComandasEstacion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => destinoSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    // Items activos (no entregados) de pedidos confirmados
    const { data: itemsActivos, error: errActivos } = await supabase
      .from("pedido_items")
      .select(
        `id_item, id_pedido, id_producto, cantidad, tiene_alergia, nota, destino,
         estado_preparacion, tiempo_planeado_min, iniciado_at, listo_at, entregado_at,
         productos:id_producto(nombre_producto, receta_master:id_receta(subcategorias:id_subcategoria(nombre))),
         pedidos!inner(id_pedido, estado, created_at, id_mesa, id_mesero, mesas:id_mesa(identificador))`,
      )
      .eq("destino", data.destino)
      .neq("estado_preparacion", "ENTREGADO")
      .eq("pedidos.estado", "CONFIRMADO")
      .order("created_at", { ascending: true });

    if (errActivos) throw new Error(errActivos.message);

    // Items entregados recientes (última hora) para columna de feedback
    const haceUnaHora = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: itemsEntregados, error: errEntregados } = await supabase
      .from("pedido_items")
      .select(
        `id_item, id_pedido, id_producto, cantidad, tiene_alergia, nota, destino,
         estado_preparacion, tiempo_planeado_min, iniciado_at, listo_at, entregado_at,
         productos:id_producto(nombre_producto, receta_master:id_receta(subcategorias:id_subcategoria(nombre))),
         pedidos!inner(id_pedido, estado, created_at, id_mesa, id_mesero, mesas:id_mesa(identificador))`,
      )
      .eq("destino", data.destino)
      .eq("estado_preparacion", "ENTREGADO")
      .gte("entregado_at", haceUnaHora)
      .order("entregado_at", { ascending: false })
      .limit(50);

    if (errEntregados) throw new Error(errEntregados.message);

    const todosItems = [...(itemsActivos ?? []), ...(itemsEntregados ?? [])];
    const itemIds = todosItems.map((i) => i.id_item);

    const [{ data: extras }, { data: excl }] = await Promise.all([
      itemIds.length
        ? supabase
            .from("pedido_item_extras")
            .select("id_item, cantidad_porcion, insumos:id_insumo_extra(nombre_insumo)")
            .in("id_item", itemIds)
        : Promise.resolve({ data: [] as unknown[] }),
      itemIds.length
        ? supabase
            .from("pedido_item_exclusiones")
            .select("id_item, insumos:id_insumo(nombre_insumo)")
            .in("id_item", itemIds)
        : Promise.resolve({ data: [] as unknown[] }),
    ]);

    const extrasByItem = new Map<string, { nombre: string; cantidad: number }[]>();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (extras as any[] | null)?.forEach((e) => {
      const arr = extrasByItem.get(e.id_item) ?? [];
      arr.push({ nombre: e.insumos?.nombre_insumo ?? "—", cantidad: Number(e.cantidad_porcion) });
      extrasByItem.set(e.id_item, arr);
    });
    const exclByItem = new Map<string, { nombre: string }[]>();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (excl as any[] | null)?.forEach((e) => {
      const arr = exclByItem.get(e.id_item) ?? [];
      arr.push({ nombre: e.insumos?.nombre_insumo ?? "—" });
      exclByItem.set(e.id_item, arr);
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mapItem = (i: any): ItemPreparacion => {
      const p = i.pedidos;
      const prod = i.productos;
      const subcat = prod?.receta_master?.subcategorias?.nombre ?? null;
      return {
        id_item: i.id_item,
        id_pedido: i.id_pedido,
        id_producto: i.id_producto,
        nombre_producto: prod?.nombre_producto ?? "—",
        nombre_subcategoria: subcat,
        cantidad: Number(i.cantidad),
        tiene_alergia: Boolean(i.tiene_alergia),
        nota: i.nota,
        destino: i.destino ?? data.destino,
        estado_preparacion: i.estado_preparacion,
        tiempo_planeado_min: i.tiempo_planeado_min,
        iniciado_at: i.iniciado_at,
        listo_at: i.listo_at,
        entregado_at: i.entregado_at,
        pedido_created_at: p?.created_at ?? "",
        mesa_identificador: p?.mesas?.identificador ?? "—",
        extras: extrasByItem.get(i.id_item) ?? [],
        exclusiones: exclByItem.get(i.id_item) ?? [],
      };
    };

    // Recopilar id_mesero por pedido y resolver nombres
    const meseroByPedido = new Map<string, string | null>();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    todosItems.forEach((raw: any) => {
      const pid = raw.id_pedido as string;
      if (!meseroByPedido.has(pid)) {
        meseroByPedido.set(pid, raw.pedidos?.id_mesero ?? null);
      }
    });
    const meseroIds = Array.from(
      new Set(Array.from(meseroByPedido.values()).filter((x): x is string => !!x)),
    );
    const nombresMesero = new Map<string, string>();
    if (meseroIds.length) {
      const { data: staff } = await supabase
        .from("usuarios_staff")
        .select("id_usuario, nombre")
        .in("id_usuario", meseroIds);
      (staff ?? []).forEach((s) => nombresMesero.set(s.id_usuario, s.nombre));
    }

    // Agrupar por pedido
    const grupos = new Map<string, ComandaEstacion>();
    todosItems.forEach((raw) => {
      const it = mapItem(raw);
      let g = grupos.get(it.id_pedido);
      if (!g) {
        const idMesero = meseroByPedido.get(it.id_pedido) ?? null;
        g = {
          id_pedido: it.id_pedido,
          mesa_identificador: it.mesa_identificador,
          pedido_created_at: it.pedido_created_at,
          mesero_nombre: idMesero ? nombresMesero.get(idMesero) ?? null : null,
          items: [],
        };
        grupos.set(it.id_pedido, g);
      }
      g.items.push(it);
    });

    // Ordenar items por subcategoría y luego por nombre (alfabético, es)
    const collator = new Intl.Collator("es", { sensitivity: "base" });
    grupos.forEach((g) => {
      g.items.sort((a, b) => {
        const sa = a.nombre_subcategoria ?? "\uffff";
        const sb = b.nombre_subcategoria ?? "\uffff";
        const cmp = collator.compare(sa, sb);
        if (cmp !== 0) return cmp;
        return collator.compare(a.nombre_producto, b.nombre_producto);
      });
    });

    const comandas = Array.from(grupos.values()).sort(
      (a, b) =>
        new Date(a.pedido_created_at).getTime() - new Date(b.pedido_created_at).getTime(),
    );

    return { comandas };
  });

export const avanzarItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => avanzarSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.rpc("avanzar_estado_item", {
      p_id_item: data.idItem,
      p_nuevo_estado: data.nuevoEstado,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const iniciarComanda = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => iniciarComandaSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: count, error } = await supabase.rpc("iniciar_comanda_estacion", {
      p_id_pedido: data.idPedido,
      p_destino: data.destino,
    });
    if (error) throw new Error(error.message);
    return { iniciados: Number(count ?? 0) };
  });
