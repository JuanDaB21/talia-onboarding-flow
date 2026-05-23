import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const destinoSchema = z.object({ destino: z.enum(["COCINA", "BARRA"]) });
const avanzarSchema = z.object({
  idItem: z.string().uuid(),
  nuevoEstado: z.enum(["EN_PREPARACION", "LISTO", "ENTREGADO"]),
});

export interface ItemPreparacion {
  id_item: string;
  id_pedido: string;
  id_producto: string;
  nombre_producto: string;
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
}

export const listarItemsEstacion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => destinoSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { data: items, error } = await supabase
      .from("pedido_items")
      .select(
        `id_item, id_pedido, id_producto, cantidad, tiene_alergia, nota, destino,
         estado_preparacion, tiempo_planeado_min, iniciado_at, listo_at, entregado_at,
         productos:id_producto(nombre_producto),
         pedidos!inner(id_pedido, estado, created_at, id_mesa, mesas:id_mesa(identificador))`,
      )
      .eq("destino", data.destino)
      .neq("estado_preparacion", "ENTREGADO")
      .eq("pedidos.estado", "CONFIRMADO")
      .order("created_at", { ascending: true });

    if (error) throw new Error(error.message);

    const itemIds = (items ?? []).map((i) => i.id_item);
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

    const out: ItemPreparacion[] = (items ?? []).map((i) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const p: any = (i as any).pedidos;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const prod: any = (i as any).productos;
      return {
        id_item: i.id_item,
        id_pedido: i.id_pedido,
        id_producto: i.id_producto,
        nombre_producto: prod?.nombre_producto ?? "—",
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
    });

    return { items: out };
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
