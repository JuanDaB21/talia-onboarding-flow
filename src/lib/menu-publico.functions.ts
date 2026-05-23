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
      .sort((a, b) => a.nombre.localeCompare(b.nombre));

    const mesaOut: CartaMesa = {
      id_mesa: mesa.id_mesa,
      identificador: mesa.identificador,
      estado: mesa.estado,
    };

    return { mesa: mesaOut, categorias, productos: productosOut };
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
      .update({ estado: "OCUPADA" })
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
  tipo: z.enum(["PEDIR_MAS", "CUENTA"]),
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
    return { ok: true };
  });
