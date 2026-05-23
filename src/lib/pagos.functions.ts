import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const idMesaInput = z.object({ idMesa: z.string().uuid() });

const registrarPagoSchema = z.object({
  idMesa: z.string().uuid(),
  metodo: z.enum(["EFECTIVO", "TRANSFERENCIA", "DATAFONO"]),
  subtipo: z.string().max(50).optional().nullable(),
  voucher: z.string().max(50).optional().nullable(),
  urlComprobante: z.string().max(500).optional().nullable(),
  itemIds: z.array(z.string().uuid()).min(1).max(200),
});

const confirmarPagoSchema = z.object({
  idPago: z.string().uuid(),
  aprobar: z.boolean(),
});

export interface ItemCobrable {
  id_item: string;
  nombre_producto: string;
  cantidad: number;
  precio_unitario: number;
  extras_total: number;
  subtotal: number;
  pagado: boolean;
  destino: string | null;
  estado_preparacion: string;
  id_pedido: string;
  pedido_numero: number;
}

export const listarItemsCobrables = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => idMesaInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: pedidos, error: pErr } = await supabase
      .from("pedidos")
      .select("id_pedido, created_at, estado")
      .eq("id_mesa", data.idMesa)
      .neq("estado", "PAGADO")
      .order("created_at", { ascending: true });
    if (pErr) throw new Error(pErr.message);
    const pedidoNum = new Map<string, number>();
    (pedidos ?? []).forEach((p, i) => pedidoNum.set(p.id_pedido, i + 1));
    const pedidoIds = (pedidos ?? []).map((p) => p.id_pedido);
    if (pedidoIds.length === 0) return { items: [] as ItemCobrable[], totalPendiente: 0 };

    const { data: items, error: iErr } = await supabase
      .from("pedido_items")
      .select(
        "id_item, id_pedido, cantidad, precio_unitario, pagado_at, destino, estado_preparacion, productos:id_producto(nombre_producto)",
      )
      .in("id_pedido", pedidoIds)
      .order("created_at", { ascending: true });
    if (iErr) throw new Error(iErr.message);

    const ids = (items ?? []).map((i) => i.id_item);
    const extrasMap = new Map<string, number>();
    if (ids.length > 0) {
      const { data: ex } = await supabase
        .from("pedido_item_extras")
        .select("id_item, precio_extra")
        .in("id_item", ids);
      (ex ?? []).forEach((e) => {
        extrasMap.set(e.id_item, (extrasMap.get(e.id_item) ?? 0) + Number(e.precio_extra ?? 0));
      });
    }

    const out: ItemCobrable[] = (items ?? []).map((i) => {
      const extras = extrasMap.get(i.id_item) ?? 0;
      const subtotal = Number(i.cantidad) * Number(i.precio_unitario) + extras;
      return {
        id_item: i.id_item,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        nombre_producto: ((i as any).productos?.nombre_producto as string) ?? "—",
        cantidad: Number(i.cantidad),
        precio_unitario: Number(i.precio_unitario),
        extras_total: extras,
        subtotal,
        pagado: Boolean(i.pagado_at),
        destino: (i.destino as string | null) ?? null,
        estado_preparacion: i.estado_preparacion as string,
        id_pedido: i.id_pedido,
        pedido_numero: pedidoNum.get(i.id_pedido) ?? 1,
      };
    });
    const totalPendiente = out.filter((x) => !x.pagado).reduce((a, b) => a + b.subtotal, 0);
    return { items: out, totalPendiente };
  });

export const registrarPago = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => registrarPagoSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: id, error } = await supabase.rpc("registrar_pago", {
      p_id_mesa: data.idMesa,
      p_metodo: data.metodo,
      p_subtipo: data.subtipo ?? "",
      p_voucher: data.voucher ?? "",
      p_url_comprobante: data.urlComprobante ?? "",
      p_item_ids: data.itemIds,
    });
    if (error) throw new Error(error.message);
    return { idPago: id as string };
  });

export const cerrarMesa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => idMesaInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.rpc("cerrar_mesa", { p_id_mesa: data.idMesa });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export interface EstadoCierreMesa {
  items_pendientes: number;
  monto_pendiente: number;
  pagos_pendientes: number;
  hay_pedidos: boolean;
  puede_cerrar: boolean;
}

export const estadoCierreMesa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => idMesaInput.parse(input))
  .handler(async ({ data, context }): Promise<EstadoCierreMesa> => {
    const { supabase } = context;
    const { data: pedidos } = await supabase
      .from("pedidos")
      .select("id_pedido")
      .eq("id_mesa", data.idMesa)
      .neq("estado", "PAGADO");
    const ids = (pedidos ?? []).map((p) => p.id_pedido);
    let items_pendientes = 0;
    let monto_pendiente = 0;
    if (ids.length > 0) {
      const { data: items } = await supabase
        .from("pedido_items")
        .select("id_item, cantidad, precio_unitario, pagado_at")
        .in("id_pedido", ids)
        .is("pagado_at", null);
      const itemIds = (items ?? []).map((i) => i.id_item);
      const extrasMap = new Map<string, number>();
      if (itemIds.length > 0) {
        const { data: ex } = await supabase
          .from("pedido_item_extras")
          .select("id_item, precio_extra")
          .in("id_item", itemIds);
        (ex ?? []).forEach((e) =>
          extrasMap.set(e.id_item, (extrasMap.get(e.id_item) ?? 0) + Number(e.precio_extra ?? 0)),
        );
      }
      items_pendientes = items?.length ?? 0;
      monto_pendiente = (items ?? []).reduce(
        (a, i) =>
          a +
          Number(i.cantidad) * Number(i.precio_unitario) +
          (extrasMap.get(i.id_item) ?? 0),
        0,
      );
    }
    const { count: pagos_pendientes } = await supabase
      .from("pagos")
      .select("id_pago", { count: "exact", head: true })
      .eq("id_mesa", data.idMesa)
      .eq("estado_confirmacion", "PENDIENTE");
    const pp = pagos_pendientes ?? 0;
    return {
      items_pendientes,
      monto_pendiente,
      pagos_pendientes: pp,
      hay_pedidos: ids.length > 0,
      puede_cerrar: ids.length > 0 && items_pendientes === 0 && pp === 0,
    };
  });

export interface PagoPendiente {
  id_pago: string;
  id_mesa: string;
  identificador_mesa: string;
  mesero_nombre: string | null;
  metodo: string;
  subtipo: string | null;
  monto: number;
  url_comprobante: string | null;
  created_at: string;
}

export const listarPagosPendientes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: yo } = await supabase
      .from("usuarios_staff")
      .select("rol")
      .eq("id_usuario", userId)
      .maybeSingle();
    const esAdmin = yo?.rol === "ADMIN" || yo?.rol === "SUPERADMIN";
    if (!esAdmin) return { pagos: [] as PagoPendiente[], esAdmin: false };

    const { data, error } = await supabase
      .from("pagos")
      .select(
        "id_pago, id_mesa, id_mesero, metodo, subtipo, monto, url_comprobante, created_at",
      )
      .eq("estado_confirmacion", "PENDIENTE")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const mesaIds = Array.from(new Set((data ?? []).map((p) => p.id_mesa)));
    const mesasMap = new Map<string, string>();
    if (mesaIds.length > 0) {
      const { data: ms } = await supabase
        .from("mesas")
        .select("id_mesa, identificador")
        .in("id_mesa", mesaIds);
      (ms ?? []).forEach((m) => mesasMap.set(m.id_mesa, m.identificador));
    }

    const meseroIds = Array.from(
      new Set((data ?? []).map((p) => p.id_mesero).filter(Boolean) as string[]),
    );
    const nombres = new Map<string, string>();
    if (meseroIds.length > 0) {
      const { data: ms } = await supabase
        .from("usuarios_staff")
        .select("id_usuario, nombre")
        .in("id_usuario", meseroIds);
      (ms ?? []).forEach((m) => nombres.set(m.id_usuario, m.nombre));
    }

    // Generar URLs firmadas para comprobantes
    const pagos: PagoPendiente[] = await Promise.all(
      (data ?? []).map(async (p) => {
        let url = p.url_comprobante;
        if (url) {
          // Si es un path del bucket (no http) firmarlo
          if (!url.startsWith("http")) {
            const { data: signed } = await supabase.storage
              .from("comprobantes-pago")
              .createSignedUrl(url, 60 * 10);
            url = signed?.signedUrl ?? null;
          }
        }
        return {
          id_pago: p.id_pago,
          id_mesa: p.id_mesa,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          identificador_mesa: ((p as any).mesas?.identificador as string) ?? "—",
          mesero_nombre: p.id_mesero ? nombres.get(p.id_mesero) ?? null : null,
          metodo: p.metodo as string,
          subtipo: (p.subtipo as string | null) ?? null,
          monto: Number(p.monto),
          url_comprobante: url,
          created_at: p.created_at,
        };
      }),
    );
    return { pagos, esAdmin: true };
  });

export const confirmarPago = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => confirmarPagoSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.rpc("confirmar_pago_transferencia", {
      p_id_pago: data.idPago,
      p_aprobar: data.aprobar,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export interface ResumenCaja {
  efectivo: number;
  transferencia_confirmada: number;
  transferencia_pendiente: number;
  datafono: number;
  total: number;
}

export const resumenCajaTurno = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    // Turno: pagos del día de este mesero
    const desde = new Date();
    desde.setHours(0, 0, 0, 0);

    const { data, error } = await supabase
      .from("pagos")
      .select("metodo, monto, estado_confirmacion")
      .eq("id_mesero", userId)
      .gte("created_at", desde.toISOString());
    if (error) throw new Error(error.message);

    const r: ResumenCaja = {
      efectivo: 0,
      transferencia_confirmada: 0,
      transferencia_pendiente: 0,
      datafono: 0,
      total: 0,
    };
    for (const p of data ?? []) {
      const m = Number(p.monto);
      if (p.estado_confirmacion === "RECHAZADO") continue;
      if (p.metodo === "EFECTIVO") r.efectivo += m;
      else if (p.metodo === "DATAFONO") r.datafono += m;
      else if (p.metodo === "TRANSFERENCIA") {
        if (p.estado_confirmacion === "CONFIRMADO") r.transferencia_confirmada += m;
        else r.transferencia_pendiente += m;
      }
      if (p.estado_confirmacion !== "PENDIENTE") r.total += m;
    }
    return r;
  });
