import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const idMesaSchema = z.object({ idMesa: z.string().uuid() });

export interface CartaProducto {
  id_producto: string;
  nombre_producto: string;
  descripcion_producto: string | null;
  precio_venta: number;
  url_imagen: string | null;
  id_categoria: string;
  nombre_categoria: string;
}

export interface CartaCategoria {
  id_categoria: string;
  nombre: string;
}

export interface CartaMesa {
  id_mesa: string;
  identificador: string;
  estado: string;
}

export interface CartaNegocio {
  nombre_comercial: string;
  url_logo: string | null;
  tema_menu: string;
}

export const getMenuPublico = createServerFn({ method: "GET" })
  .inputValidator((input) => idMesaSchema.parse(input))
  .handler(async ({ data }) => {
    const { data: mesa, error: mesaErr } = await supabaseAdmin
      .from("mesas")
      .select("id_mesa, id_negocio, identificador, estado")
      .eq("id_mesa", data.idMesa)
      .maybeSingle();
    if (mesaErr) throw new Error(mesaErr.message);
    if (!mesa) throw new Error("Mesa no encontrada");

    const { data: negocio, error: negErr } = await supabaseAdmin
      .from("negocio")
      .select("nombre_comercial, url_logo, tema_menu")
      .eq("id_negocio", mesa.id_negocio)
      .maybeSingle();
    if (negErr) throw new Error(negErr.message);

    const { data: catsAll, error: catsErr } = await supabaseAdmin
      .from("categorias")
      .select("id_categoria, nombre, orden")
      .eq("id_negocio", mesa.id_negocio)
      .order("orden", { ascending: true })
      .order("nombre", { ascending: true });
    if (catsErr) throw new Error(catsErr.message);

    const ordenCat = new Map<string, number>();
    (catsAll ?? []).forEach((c, i) => ordenCat.set(c.id_categoria, i));

    const { data: productos, error: prodErr } = await supabaseAdmin
      .from("productos")
      .select(
        "id_producto, nombre_producto, descripcion_producto, precio_venta, url_imagen, id_receta, receta_master:id_receta(id_categoria, categorias:id_categoria(id_categoria, nombre))",
      )
      .eq("id_negocio", mesa.id_negocio)
      .eq("activo", true)
      .order("nombre_producto");
    if (prodErr) throw new Error(prodErr.message);

    const productosOut: CartaProducto[] = [];
    const catsMap = new Map<string, string>();

    for (const p of productos ?? []) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rm: any = (p as any).receta_master;
      const cat = rm?.categorias;
      if (!cat?.id_categoria) continue;
      catsMap.set(cat.id_categoria, cat.nombre);
      productosOut.push({
        id_producto: p.id_producto,
        nombre_producto: p.nombre_producto,
        descripcion_producto: p.descripcion_producto,
        precio_venta: Number(p.precio_venta),
        url_imagen: p.url_imagen,
        id_categoria: cat.id_categoria,
        nombre_categoria: cat.nombre,
      });
    }

    const categorias: CartaCategoria[] = Array.from(catsMap.entries())
      .map(([id_categoria, nombre]) => ({ id_categoria, nombre }))
      .sort((a, b) => (ordenCat.get(a.id_categoria) ?? 9999) - (ordenCat.get(b.id_categoria) ?? 9999));


    const mesaOut: CartaMesa = {
      id_mesa: mesa.id_mesa,
      identificador: mesa.identificador,
      estado: mesa.estado,
    };

    const negocioOut: CartaNegocio = {
      nombre_comercial: negocio?.nombre_comercial ?? "",
      url_logo: negocio?.url_logo ?? null,
      tema_menu: negocio?.tema_menu ?? "verde-bosque",
    };

    return { mesa: mesaOut, negocio: negocioOut, categorias, productos: productosOut };
  });

export const llamarMesero = createServerFn({ method: "POST" })
  .inputValidator((input) => idMesaSchema.parse(input))
  .handler(async ({ data }) => {
    const { data: mesa, error: mErr } = await supabaseAdmin
      .from("mesas")
      .select("id_mesa, id_mesero_asignado")
      .eq("id_mesa", data.idMesa)
      .maybeSingle();
    if (mErr) throw new Error(mErr.message);
    if (!mesa) throw new Error("Mesa no encontrada");

    const { error } = await supabaseAdmin
      .from("mesas")
      .update({
        estado: "OCUPADA",
        solicitud_cliente: "LLAMADO",
        solicitud_at: new Date().toISOString(),
      })
      .eq("id_mesa", data.idMesa);
    if (error) throw new Error(error.message);

    if (!mesa.id_mesero_asignado) {
      // Intento de asignación; si no hay meseros en turno, queda NULL.
      await supabaseAdmin.rpc("asignar_mesero_a_mesa", { p_id_mesa: data.idMesa });
    }
    return { ok: true };
  });

const solicitudSchema = z.object({
  idMesa: z.string().uuid(),
  tipo: z.enum(["PEDIR_MAS", "CUENTA", "TOMAR_PEDIDO"]),
});


export interface EstadoMesaPublico {
  id_mesa: string;
  identificador: string;
  estado: string;
  tiene_pedido_activo: boolean;
}

export const getEstadoMesaPublico = createServerFn({ method: "POST" })
  .inputValidator((input) => idMesaSchema.parse(input))
  .handler(async ({ data }) => {
    const { data: mesa, error } = await supabaseAdmin
      .from("mesas")
      .select("id_mesa, identificador, estado")
      .eq("id_mesa", data.idMesa)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!mesa) throw new Error("Mesa no encontrada");

    const { count } = await supabaseAdmin
      .from("pedidos")
      .select("id_pedido", { count: "exact", head: true })
      .eq("id_mesa", data.idMesa)
      .eq("estado", "CONFIRMADO");

    const out: EstadoMesaPublico = {
      id_mesa: mesa.id_mesa,
      identificador: mesa.identificador,
      estado: mesa.estado,
      tiene_pedido_activo: (count ?? 0) > 0,
    };
    return out;
  });

export const solicitarAccionCliente = createServerFn({ method: "POST" })
  .inputValidator((input) => solicitudSchema.parse(input))
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin.rpc("solicitar_accion_cliente", {
      p_id_mesa: data.idMesa,
      p_tipo: data.tipo,
    });
    if (error) throw new Error(error.message);

    // Asignar mesero a la mesa con el mismo comportamiento que "Llamar mesero":
    // si la mesa aún no tiene mesero asignado, intentar asignar uno en turno.
    const { data: mesa } = await supabaseAdmin
      .from("mesas")
      .select("id_mesero_asignado")
      .eq("id_mesa", data.idMesa)
      .maybeSingle();
    if (mesa && !mesa.id_mesero_asignado) {
      await supabaseAdmin.rpc("asignar_mesero_a_mesa", { p_id_mesa: data.idMesa });
    }
    return { ok: true };
  });

export interface CuentaItem {
  id_item: string;
  nombre_producto: string;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
  extras: Array<{ nombre: string; precio: number }>;
  exclusiones: Array<{ nombre: string }>;
  variantes: Array<{ nombre_grupo: string; nombre_opcion: string; precio_delta: number }>;
  nota: string | null;
}

export interface CuentaPublica {
  identificador_mesa: string;
  nombre_negocio: string;
  url_logo: string | null;
  items: CuentaItem[];
  total: number;
  fecha: string;
}

export const getCuentaPublica = createServerFn({ method: "POST" })
  .inputValidator((input) => idMesaSchema.parse(input))
  .handler(async ({ data }) => {
    const { data: mesa, error: mErr } = await supabaseAdmin
      .from("mesas")
      .select("id_mesa, identificador, id_negocio")
      .eq("id_mesa", data.idMesa)
      .maybeSingle();
    if (mErr) throw new Error(mErr.message);
    if (!mesa) throw new Error("Mesa no encontrada");

    const { data: negocio } = await supabaseAdmin
      .from("negocio")
      .select("nombre_comercial, url_logo")
      .eq("id_negocio", mesa.id_negocio)
      .maybeSingle();

    const { data: pedidos, error: pErr } = await supabaseAdmin
      .from("pedidos")
      .select("id_pedido")
      .eq("id_mesa", data.idMesa)
      .neq("estado", "PAGADO");
    if (pErr) throw new Error(pErr.message);

    const pedidoIds = (pedidos ?? []).map((p) => p.id_pedido);
    const items: CuentaItem[] = [];
    let total = 0;

    if (pedidoIds.length > 0) {
      const { data: itemsRaw, error: iErr } = await supabaseAdmin
        .from("pedido_items")
        .select(
          `id_item, cantidad, precio_unitario, nota,
           productos:id_producto(nombre_producto)`,
        )
        .in("id_pedido", pedidoIds)
        .order("created_at", { ascending: true });
      if (iErr) throw new Error(iErr.message);

      const itemIds = (itemsRaw ?? []).map((i) => i.id_item as string);
      let extrasRaw: Array<Record<string, unknown>> = [];
      let exclRaw: Array<Record<string, unknown>> = [];
      let varRaw: Array<Record<string, unknown>> = [];
      if (itemIds.length > 0) {
        const [{ data: ex }, { data: xc }, { data: vv }] = await Promise.all([
          supabaseAdmin
            .from("pedido_item_extras")
            .select("id_item, precio_extra, insumos:id_insumo_extra(nombre_insumo)")
            .in("id_item", itemIds),
          supabaseAdmin
            .from("pedido_item_exclusiones")
            .select("id_item, insumos:id_insumo(nombre_insumo)")
            .in("id_item", itemIds),
          supabaseAdmin
            .from("pedido_item_variantes")
            .select("id_item, nombre_grupo, nombre_opcion, precio_delta")
            .in("id_item", itemIds),
        ]);
        extrasRaw = (ex ?? []) as Array<Record<string, unknown>>;
        exclRaw = (xc ?? []) as Array<Record<string, unknown>>;
        varRaw = (vv ?? []) as Array<Record<string, unknown>>;
      }

      const extrasByItem = new Map<string, CuentaItem["extras"]>();
      for (const e of extrasRaw) {
        const arr = extrasByItem.get(e.id_item as string) ?? [];
        arr.push({
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          nombre: ((e as any).insumos?.nombre_insumo as string) ?? "—",
          precio: Number(e.precio_extra ?? 0),
        });
        extrasByItem.set(e.id_item as string, arr);
      }
      const exclByItem = new Map<string, CuentaItem["exclusiones"]>();
      for (const x of exclRaw) {
        const arr = exclByItem.get(x.id_item as string) ?? [];
        arr.push({
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          nombre: ((x as any).insumos?.nombre_insumo as string) ?? "—",
        });
        exclByItem.set(x.id_item as string, arr);
      }
      const varByItem = new Map<string, CuentaItem["variantes"]>();
      for (const v of varRaw) {
        const arr = varByItem.get(v.id_item as string) ?? [];
        arr.push({
          nombre_grupo: (v.nombre_grupo as string) ?? "",
          nombre_opcion: (v.nombre_opcion as string) ?? "",
          precio_delta: Number(v.precio_delta ?? 0),
        });
        varByItem.set(v.id_item as string, arr);
      }

      for (const i of itemsRaw ?? []) {
        const cantidad = Number(i.cantidad);
        const precio = Number(i.precio_unitario);
        const extras = extrasByItem.get(i.id_item as string) ?? [];
        const variantes = varByItem.get(i.id_item as string) ?? [];
        const extrasTotal = extras.reduce((s, e) => s + e.precio, 0);
        const varTotal = variantes.reduce((s, v) => s + v.precio_delta, 0);
        const subtotal = (precio + extrasTotal + varTotal) * cantidad;
        total += subtotal;
        items.push({
          id_item: i.id_item as string,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          nombre_producto: ((i as any).productos?.nombre_producto as string) ?? "—",
          cantidad,
          precio_unitario: precio,
          subtotal,
          extras,
          exclusiones: exclByItem.get(i.id_item as string) ?? [],
          variantes,
          nota: (i.nota as string | null) ?? null,
        });
      }
    }

    const out: CuentaPublica = {
      identificador_mesa: mesa.identificador,
      nombre_negocio: negocio?.nombre_comercial ?? "",
      url_logo: negocio?.url_logo ?? null,
      items,
      total,
      fecha: new Date().toISOString(),
    };
    return out;
  });
