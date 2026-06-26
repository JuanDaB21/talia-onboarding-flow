import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface ResumenCajaDia {
  caja: {
    id_caja: string;
    fecha: string;
    estado: "ABIERTA" | "CERRADA";
    base_inicial: number;
    abierta_at: string;
    cerrada_at: string | null;
  } | null;
  efectivo: number;
  transferencia_confirmada: number;
  transferencia_pendiente: number;
  datafono: number;
  total_sistema: number;
  pagos_pendientes: number;
  mesas_abiertas: number;
  efectivo_por_mesero: Array<{ id_mesero: string | null; nombre: string; monto: number }>;
}

export const getEstadoCaja = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ResumenCajaDia> => {
    const { supabase } = context;
    const { data, error } = await supabase.rpc("resumen_caja_dia");
    if (error) throw new Error(error.message);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = data as any;
    return {
      caja: r?.caja ?? null,
      efectivo: Number(r?.efectivo ?? 0),
      transferencia_confirmada: Number(r?.transferencia_confirmada ?? 0),
      transferencia_pendiente: Number(r?.transferencia_pendiente ?? 0),
      datafono: Number(r?.datafono ?? 0),
      total_sistema: Number(r?.total_sistema ?? 0),
      pagos_pendientes: Number(r?.pagos_pendientes ?? 0),
      mesas_abiertas: Number(r?.mesas_abiertas ?? 0),
      efectivo_por_mesero: (r?.efectivo_por_mesero ?? []).map(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (e: any) => ({
          id_mesero: e.id_mesero ?? null,
          nombre: e.nombre ?? "—",
          monto: Number(e.monto ?? 0),
        }),
      ),
    };
  });

export const abrirCaja = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ base: z.number().min(0).max(100000000) }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: id, error } = await supabase.rpc("abrir_caja", { p_base: data.base });
    if (error) throw new Error(error.message);
    return { idCaja: id as string };
  });

export const cerrarCaja = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        efectivoFisico: z.number().min(0).max(1000000000),
        datafonoFisico: z.number().min(0).max(1000000000),
        nota: z.string().max(1000).optional().nullable(),
        ajustes: z
          .array(
            z.object({
              idTipo: z.string().uuid(),
              monto: z.number().positive().max(1000000000),
              nota: z.string().max(500).optional().nullable(),
            }),
          )
          .max(50)
          .optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: id, error } = await supabase.rpc("cerrar_caja", {
      p_efectivo_fisico: data.efectivoFisico,
      p_datafono_fisico: data.datafonoFisico,
      p_nota: data.nota ?? "",
    });
    if (error) throw new Error(error.message);
    const idCaja = id as string;

    if (data.ajustes && data.ajustes.length > 0) {
      // Obtener id_negocio del cierre
      const { data: cajaRow } = await supabase
        .from("caja_dia")
        .select("id_negocio")
        .eq("id_caja", idCaja)
        .maybeSingle();
      const idNegocio = cajaRow?.id_negocio;
      if (idNegocio) {
        const rows = data.ajustes.map((a) => ({
          id_caja: idCaja,
          id_negocio: idNegocio,
          id_tipo: a.idTipo,
          monto: a.monto,
          nota: a.nota ?? null,
        }));
        const { error: errIns } = await supabase.from("caja_ajustes").insert(rows);
        if (errIns) throw new Error(`Caja cerrada pero falló registrar ajustes: ${errIns.message}`);
      }
    }
    return { idCaja };
  });

export interface AjusteTipo {
  id_tipo: string;
  nombre: string;
  signo: "POSITIVO" | "NEGATIVO";
  activo: boolean;
}

export const listarTiposAjuste = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AjusteTipo[]> => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("caja_ajuste_tipos")
      .select("id_tipo, nombre, signo, activo")
      .eq("activo", true)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as AjusteTipo[];
  });

export const crearTipoAjuste = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        nombre: z.string().trim().min(1).max(60),
        signo: z.enum(["POSITIVO", "NEGATIVO"]).default("NEGATIVO"),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<AjusteTipo> => {
    const { supabase } = context;
    // Resolver id_negocio del usuario
    const { data: staff } = await supabase
      .from("usuarios_staff")
      .select("id_negocio")
      .eq("id_usuario", context.userId)
      .maybeSingle();
    if (!staff?.id_negocio) throw new Error("No autorizado");
    const { data: row, error } = await supabase
      .from("caja_ajuste_tipos")
      .insert({
        id_negocio: staff.id_negocio,
        nombre: data.nombre,
        signo: data.signo,
      })
      .select("id_tipo, nombre, signo, activo")
      .single();
    if (error) {
      if (error.code === "23505") throw new Error("Ya existe un tipo con ese nombre");
      throw new Error(error.message);
    }
    return row as AjusteTipo;
  });

export interface CierreDetalle {
  id_caja: string;
  fecha: string;
  estado: string;
  base_inicial: number;
  efectivo_sistema: number;
  transferencia_sistema: number;
  datafono_sistema: number;
  efectivo_fisico: number;
  datafono_fisico: number;
  diferencia_efectivo: number;
  diferencia_datafono: number;
  nota_cuadre: string | null;
  abierta_at: string;
  cerrada_at: string | null;
  negocio_nombre: string;
  top_productos: Array<{ nombre: string; cantidad: number; total: number }>;
  hora_pico: { hora: number; total: number } | null;
}

export const getCierre = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ idCaja: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<CierreDetalle> => {
    const { supabase } = context;
    const { data: caja, error } = await supabase
      .from("caja_dia")
      .select("*")
      .eq("id_caja", data.idCaja)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!caja) throw new Error("Cierre no encontrado");

    const { data: neg } = await supabase
      .from("negocio")
      .select("nombre_comercial")
      .maybeSingle();

    // Top productos de ese día
    const inicio = `${caja.fecha}T00:00:00Z`;
    const fin = `${caja.fecha}T23:59:59Z`;
    const { data: pedidosDia } = await supabase
      .from("pedidos")
      .select("id_pedido")
      .gte("created_at", inicio)
      .lte("created_at", fin);
    const pedidoIds = (pedidosDia ?? []).map((p) => p.id_pedido);
    const topProductos: CierreDetalle["top_productos"] = [];
    if (pedidoIds.length > 0) {
      const { data: items } = await supabase
        .from("pedido_items")
        .select("cantidad, precio_unitario, productos:id_producto(nombre_producto)")
        .in("id_pedido", pedidoIds);
      const agg = new Map<string, { cantidad: number; total: number }>();
      for (const it of items ?? []) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const nombre = (it as any).productos?.nombre_producto ?? "—";
        const cur = agg.get(nombre) ?? { cantidad: 0, total: 0 };
        cur.cantidad += Number(it.cantidad);
        cur.total += Number(it.cantidad) * Number(it.precio_unitario);
        agg.set(nombre, cur);
      }
      const arr = Array.from(agg.entries()).map(([nombre, v]) => ({ nombre, ...v }));
      arr.sort((a, b) => b.cantidad - a.cantidad);
      topProductos.push(...arr.slice(0, 10));
    }

    // Hora pico (por monto de pagos)
    const { data: pagosDia } = await supabase
      .from("pagos")
      .select("monto, created_at, estado_confirmacion")
      .eq("estado_confirmacion", "CONFIRMADO")
      .gte("created_at", inicio)
      .lte("created_at", fin);
    const horas = new Map<number, number>();
    for (const p of pagosDia ?? []) {
      const h = new Date(p.created_at).getHours();
      horas.set(h, (horas.get(h) ?? 0) + Number(p.monto));
    }
    let horaPico: CierreDetalle["hora_pico"] = null;
    for (const [h, t] of horas) {
      if (!horaPico || t > horaPico.total) horaPico = { hora: h, total: t };
    }

    return {
      id_caja: caja.id_caja,
      fecha: caja.fecha,
      estado: caja.estado,
      base_inicial: Number(caja.base_inicial),
      efectivo_sistema: Number(caja.efectivo_sistema),
      transferencia_sistema: Number(caja.transferencia_sistema),
      datafono_sistema: Number(caja.datafono_sistema),
      efectivo_fisico: Number(caja.efectivo_fisico),
      datafono_fisico: Number(caja.datafono_fisico),
      diferencia_efectivo: Number(caja.diferencia_efectivo),
      diferencia_datafono: Number(caja.diferencia_datafono),
      nota_cuadre: caja.nota_cuadre,
      abierta_at: caja.abierta_at,
      cerrada_at: caja.cerrada_at,
      negocio_nombre: neg?.nombre_comercial ?? "Negocio",
      top_productos: topProductos,
      hora_pico: horaPico,
    };
  });

export const listarCierres = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        desde: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
        hasta: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
      })
      .optional()
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let q = supabase
      .from("caja_dia")
      .select("id_caja, fecha, estado, efectivo_sistema, transferencia_sistema, datafono_sistema, diferencia_efectivo, diferencia_datafono, cerrada_at")
      .order("fecha", { ascending: false })
      .limit(200);
    if (data?.desde) q = q.gte("fecha", data.desde);
    if (data?.hasta) q = q.lte("fecha", data.hasta);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return {
      cierres: (rows ?? []).map((c) => ({
        id_caja: c.id_caja,
        fecha: c.fecha,
        estado: c.estado,
        total: Number(c.efectivo_sistema) + Number(c.transferencia_sistema) + Number(c.datafono_sistema),
        diferencia: Number(c.diferencia_efectivo) + Number(c.diferencia_datafono),
        cerrada_at: c.cerrada_at,
      })),
    };
  });

