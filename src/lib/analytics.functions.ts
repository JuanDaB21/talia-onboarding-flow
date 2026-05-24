import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const rangoSchema = z.object({ rango: z.enum(["hoy", "7d", "30d"]) });

function rangoToDesde(rango: "hoy" | "7d" | "30d"): string {
  const d = new Date();
  if (rango === "hoy") {
    d.setHours(0, 0, 0, 0);
  } else if (rango === "7d") {
    d.setDate(d.getDate() - 7);
  } else {
    d.setDate(d.getDate() - 30);
  }
  return d.toISOString();
}

// ============================================================
// 1. INGENIERÍA DEL MENÚ
// ============================================================
export type Cuadrante = "STAR" | "PLOWHORSE" | "PUZZLE" | "DOG";

export interface ProductoMenu {
  id_producto: string;
  nombre: string;
  unidades: number;
  precio: number;
  costo: number;
  margen_unit: number;
  margen_pct: number;
  ingresos: number;
  cuadrante: Cuadrante;
}

export interface IngenieriaMenu {
  productos: ProductoMenu[];
  food_cost_pct: number;
  margen_promedio_pct: number;
  ingresos_totales: number;
  costo_total: number;
  conteo_por_cuadrante: Record<Cuadrante, number>;
}

export const getIngenieriaMenu = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => rangoSchema.parse(input))
  .handler(async ({ data, context }): Promise<IngenieriaMenu> => {
    const { supabase } = context;
    const desde = rangoToDesde(data.rango);

    // Pedidos confirmados/pagados
    const { data: pedidos } = await supabase
      .from("pedidos")
      .select("id_pedido")
      .in("estado", ["CONFIRMADO", "PAGADO"])
      .gte("created_at", desde);
    const idsP = (pedidos ?? []).map((p) => p.id_pedido);

    const ventas = new Map<string, number>();
    if (idsP.length > 0) {
      const { data: items } = await supabase
        .from("pedido_items")
        .select("id_producto, cantidad")
        .in("id_pedido", idsP);
      for (const it of items ?? []) {
        ventas.set(it.id_producto, (ventas.get(it.id_producto) ?? 0) + Number(it.cantidad));
      }
    }

    // Productos activos
    const { data: productos } = await supabase
      .from("productos")
      .select("id_producto, nombre_producto, precio_venta, id_receta")
      .eq("activo", true);

    // Costos por receta
    const recetaIds = Array.from(new Set((productos ?? []).map((p) => p.id_receta).filter(Boolean) as string[]));
    const costoReceta = new Map<string, number>();
    if (recetaIds.length > 0) {
      const { data: det } = await supabase
        .from("receta_detalle")
        .select("id_receta, cantidad, insumos:id_insumo(costo_promedio, factor_conversion)")
        .in("id_receta", recetaIds);
      for (const d of det ?? []) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const ins = (d as any).insumos;
        const costoUnitReceta = ins ? Number(ins.costo_promedio) / Math.max(1, Number(ins.factor_conversion ?? 1)) : 0;
        const sub = Number(d.cantidad) * costoUnitReceta;
        costoReceta.set(d.id_receta as string, (costoReceta.get(d.id_receta as string) ?? 0) + sub);
      }
    }

    const enriched = (productos ?? []).map((p) => {
      const unidades = ventas.get(p.id_producto) ?? 0;
      const precio = Number(p.precio_venta);
      const costo = costoReceta.get(p.id_receta) ?? 0;
      const margen_unit = precio - costo;
      const margen_pct = precio > 0 ? (margen_unit / precio) * 100 : 0;
      return {
        id_producto: p.id_producto,
        nombre: p.nombre_producto,
        unidades,
        precio,
        costo,
        margen_unit,
        margen_pct,
        ingresos: unidades * precio,
      };
    });

    const promUnidades = enriched.length ? enriched.reduce((a, b) => a + b.unidades, 0) / enriched.length : 0;
    const promMargen = enriched.length ? enriched.reduce((a, b) => a + b.margen_unit, 0) / enriched.length : 0;
    const umbralPop = promUnidades * 0.7;

    const conteo: Record<Cuadrante, number> = { STAR: 0, PLOWHORSE: 0, PUZZLE: 0, DOG: 0 };
    const productosOut: ProductoMenu[] = enriched.map((p) => {
      const popular = p.unidades >= umbralPop;
      const rentable = p.margen_unit >= promMargen;
      const cuadrante: Cuadrante = popular && rentable ? "STAR" : popular ? "PLOWHORSE" : rentable ? "PUZZLE" : "DOG";
      conteo[cuadrante]++;
      return { ...p, cuadrante };
    });
    productosOut.sort((a, b) => b.ingresos - a.ingresos);

    const ingresosTot = productosOut.reduce((a, p) => a + p.ingresos, 0);
    const costoTot = productosOut.reduce((a, p) => a + p.costo * p.unidades, 0);
    const food_cost_pct = ingresosTot > 0 ? (costoTot / ingresosTot) * 100 : 0;
    const margenPromedioPct = productosOut.length
      ? productosOut.reduce((a, p) => a + p.margen_pct, 0) / productosOut.length
      : 0;

    return {
      productos: productosOut,
      food_cost_pct,
      margen_promedio_pct: margenPromedioPct,
      ingresos_totales: ingresosTot,
      costo_total: costoTot,
      conteo_por_cuadrante: conteo,
    };
  });

// ============================================================
// 2. COMPORTAMIENTO DEL CLIENTE
// ============================================================
export interface ComportamientoCliente {
  heatmap: number[][]; // [dia][hora] = $ pagos
  ticket_promedio_mesa: number;
  mesas_cerradas: number;
  ventas_totales: number;
  upselling_pct: number;
  pedidos_totales: number;
  pedidos_con_extras: number;
}

export const getComportamientoCliente = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => rangoSchema.parse(input))
  .handler(async ({ data, context }): Promise<ComportamientoCliente> => {
    const { supabase } = context;
    const desde = rangoToDesde(data.rango);

    // Heatmap por pagos confirmados
    const { data: pagos } = await supabase
      .from("pagos")
      .select("monto, created_at")
      .eq("estado_confirmacion", "CONFIRMADO")
      .gte("created_at", desde);
    const heatmap: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
    let ventas = 0;
    for (const p of pagos ?? []) {
      const d = new Date(p.created_at);
      heatmap[d.getDay()][d.getHours()] += Number(p.monto);
      ventas += Number(p.monto);
    }

    // Ticket promedio (mesas cerradas)
    const { data: ped } = await supabase
      .from("pedidos")
      .select("id_pedido, id_mesa, pagado_at")
      .eq("estado", "PAGADO")
      .gte("pagado_at", desde);
    const mesasCerradas = new Set((ped ?? []).map((p) => p.id_mesa)).size;
    const ticket = mesasCerradas > 0 ? ventas / mesasCerradas : 0;

    // Upselling
    const { data: pedRango } = await supabase
      .from("pedidos")
      .select("id_pedido")
      .gte("created_at", desde)
      .in("estado", ["CONFIRMADO", "PAGADO"]);
    const idsR = (pedRango ?? []).map((p) => p.id_pedido);
    let conExtras = 0;
    if (idsR.length > 0) {
      const { data: items } = await supabase
        .from("pedido_items")
        .select("id_item, id_pedido, pedido_item_extras(id_pie)")
        .in("id_pedido", idsR);
      const setPedExtras = new Set<string>();
      for (const it of items ?? []) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const ex = (it as any).pedido_item_extras as unknown[] | null;
        if (ex && ex.length > 0) setPedExtras.add(it.id_pedido);
      }
      conExtras = setPedExtras.size;
    }
    const upPct = idsR.length > 0 ? (conExtras / idsR.length) * 100 : 0;

    return {
      heatmap,
      ticket_promedio_mesa: ticket,
      mesas_cerradas: mesasCerradas,
      ventas_totales: ventas,
      upselling_pct: upPct,
      pedidos_totales: idsR.length,
      pedidos_con_extras: conExtras,
    };
  });

// ============================================================
// 3. EFICIENCIA OPERATIVA
// ============================================================
export interface ProductoLento {
  id_producto: string;
  nombre: string;
  destino: string | null;
  tiempo_real_prom: number;
  tiempo_planeado_prom: number;
  desviacion_min: number;
  muestras: number;
}
export interface MeseroPerf {
  id_usuario: string;
  nombre: string;
  mesas_atendidas: number;
  tiempo_resp_prom_min: number | null;
  total_vendido: number;
}
export interface EficienciaOperativa {
  ciclo_mesa_prom_min: number | null;
  ciclo_mesa_muestras: number;
  productos_lentos: ProductoLento[];
  meseros: MeseroPerf[];
}

export const getEficienciaOperativa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => rangoSchema.parse(input))
  .handler(async ({ data, context }): Promise<EficienciaOperativa> => {
    const { supabase } = context;
    const desde = rangoToDesde(data.rango);

    // Ciclo de mesa: pedidos pagados con created_at y pagado_at
    const { data: pedPag } = await supabase
      .from("pedidos")
      .select("id_mesa, created_at, pagado_at, id_mesero, total")
      .eq("estado", "PAGADO")
      .gte("pagado_at", desde);
    // Agrupar por mesa+pagado_at (un cierre)
    let sumaCiclo = 0;
    let nCiclo = 0;
    for (const p of pedPag ?? []) {
      if (!p.pagado_at) continue;
      const min = (new Date(p.pagado_at).getTime() - new Date(p.created_at).getTime()) / 60000;
      if (min > 0 && min < 60 * 8) {
        sumaCiclo += min;
        nCiclo++;
      }
    }
    const ciclo = nCiclo > 0 ? sumaCiclo / nCiclo : null;

    // Productos lentos: items con iniciado_at y listo_at en rango
    const { data: items } = await supabase
      .from("pedido_items")
      .select("id_producto, destino, iniciado_at, listo_at, tiempo_planeado_min, productos:id_producto(nombre_producto)")
      .gte("listo_at", desde)
      .not("iniciado_at", "is", null)
      .not("listo_at", "is", null);
    const agg = new Map<string, { nombre: string; destino: string | null; real: number; plan: number; n: number }>();
    for (const it of items ?? []) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const anyIt = it as any;
      const real = (new Date(it.listo_at!).getTime() - new Date(it.iniciado_at!).getTime()) / 60000;
      const plan = Number(it.tiempo_planeado_min ?? 0);
      const k = it.id_producto;
      const cur = agg.get(k) ?? { nombre: anyIt.productos?.nombre_producto ?? "—", destino: it.destino as string | null, real: 0, plan: 0, n: 0 };
      cur.real += real;
      cur.plan += plan;
      cur.n++;
      agg.set(k, cur);
    }
    const lentos: ProductoLento[] = Array.from(agg.entries())
      .filter(([, v]) => v.n >= 2)
      .map(([id, v]) => ({
        id_producto: id,
        nombre: v.nombre,
        destino: v.destino,
        tiempo_real_prom: v.real / v.n,
        tiempo_planeado_prom: v.plan / v.n,
        desviacion_min: v.real / v.n - v.plan / v.n,
        muestras: v.n,
      }))
      .sort((a, b) => b.desviacion_min - a.desviacion_min)
      .slice(0, 5);

    // Meseros
    const { data: meseros } = await supabase
      .from("usuarios_staff")
      .select("id_usuario, nombre, rol")
      .eq("rol", "MESERO");
    const meseroOut: MeseroPerf[] = [];
    for (const m of meseros ?? []) {
      const propios = (pedPag ?? []).filter((p) => p.id_mesero === m.id_usuario);
      const mesasAt = new Set(propios.map((p) => p.id_mesa)).size;
      const totalVend = propios.reduce((a, p) => a + Number(p.total), 0);

      // tiempo respuesta: items entregados por mesero en rango
      const { data: itM } = await supabase
        .from("pedido_items")
        .select("listo_at, entregado_at, pedidos!inner(id_mesero)")
        .eq("pedidos.id_mesero", m.id_usuario)
        .gte("entregado_at", desde)
        .not("listo_at", "is", null)
        .not("entregado_at", "is", null);
      let sumR = 0;
      let nR = 0;
      for (const it of itM ?? []) {
        const min = (new Date(it.entregado_at!).getTime() - new Date(it.listo_at!).getTime()) / 60000;
        if (min >= 0 && min < 120) {
          sumR += min;
          nR++;
        }
      }
      meseroOut.push({
        id_usuario: m.id_usuario,
        nombre: m.nombre,
        mesas_atendidas: mesasAt,
        tiempo_resp_prom_min: nR > 0 ? sumR / nR : null,
        total_vendido: totalVend,
      });
    }
    meseroOut.sort((a, b) => b.total_vendido - a.total_vendido);

    return {
      ciclo_mesa_prom_min: ciclo,
      ciclo_mesa_muestras: nCiclo,
      productos_lentos: lentos,
      meseros: meseroOut,
    };
  });

// ============================================================
// 4. ALERTAS Y FUGAS
// ============================================================
export interface DesviacionInsumo {
  id_insumo: string;
  nombre: string;
  teorico: number;
  real: number;
  diferencia: number;
  diferencia_pct: number;
}
export interface AlertasFugas {
  items_cancelados: number;
  cuello_botella: number;
  cuello_umbral: number;
  desviaciones: DesviacionInsumo[];
}

export const getAlertasFugas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => rangoSchema.parse(input))
  .handler(async ({ data, context }): Promise<AlertasFugas> => {
    const { supabase } = context;
    const desde = rangoToDesde(data.rango);

    // Cancelados (si existe estado CANCELADO)
    const { count: cancelados } = await supabase
      .from("pedido_items")
      .select("id_item", { count: "exact", head: true })
      .eq("estado_preparacion", "CANCELADO")
      .gte("created_at", desde);

    // Cuello de botella en vivo
    const { count: enCola } = await supabase
      .from("pedido_items")
      .select("id_item", { count: "exact", head: true })
      .in("estado_preparacion", ["EN_COLA", "EN_PREPARACION"]);

    // Desviación de inventario
    // Consumo teórico: por items vendidos en rango × receta
    const { data: ped } = await supabase
      .from("pedidos")
      .select("id_pedido")
      .in("estado", ["CONFIRMADO", "PAGADO"])
      .gte("created_at", desde);
    const idsP = (ped ?? []).map((p) => p.id_pedido);

    const teorico = new Map<string, number>();
    if (idsP.length > 0) {
      const { data: items } = await supabase
        .from("pedido_items")
        .select("cantidad, id_producto, productos:id_producto(id_receta)")
        .in("id_pedido", idsP);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const recetaIds = Array.from(new Set((items ?? []).map((i: any) => i.productos?.id_receta).filter(Boolean) as string[]));
      const det = new Map<string, { id_insumo: string; cantidad: number }[]>();
      if (recetaIds.length > 0) {
        const { data: ds } = await supabase
          .from("receta_detalle")
          .select("id_receta, id_insumo, cantidad")
          .in("id_receta", recetaIds);
        for (const d of ds ?? []) {
          const arr = det.get(d.id_receta) ?? [];
          arr.push({ id_insumo: d.id_insumo, cantidad: Number(d.cantidad) });
          det.set(d.id_receta, arr);
        }
      }
      for (const it of items ?? []) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rid = (it as any).productos?.id_receta;
        if (!rid) continue;
        const arr = det.get(rid) ?? [];
        for (const a of arr) {
          teorico.set(a.id_insumo, (teorico.get(a.id_insumo) ?? 0) + a.cantidad * Number(it.cantidad));
        }
      }
    }

    // Consumo real: movimientos SALIDA o AJUSTE negativo
    const real = new Map<string, number>();
    const { data: movs } = await supabase
      .from("movimientos_inventario")
      .select("id_insumo, tipo_movimiento, cantidad")
      .gte("created_at", desde);
    for (const m of movs ?? []) {
      const tipo = String(m.tipo_movimiento).toUpperCase();
      const c = Number(m.cantidad);
      if (tipo.includes("SALIDA") || tipo.includes("MERMA") || (tipo.includes("AJUSTE") && c < 0)) {
        real.set(m.id_insumo, (real.get(m.id_insumo) ?? 0) + Math.abs(c));
      }
    }

    const insumoIds = Array.from(new Set([...teorico.keys(), ...real.keys()]));
    const nombres = new Map<string, string>();
    if (insumoIds.length > 0) {
      const { data: ins } = await supabase
        .from("insumos")
        .select("id_insumo, nombre_insumo")
        .in("id_insumo", insumoIds);
      (ins ?? []).forEach((i) => nombres.set(i.id_insumo, i.nombre_insumo));
    }
    const desviaciones: DesviacionInsumo[] = insumoIds
      .map((id) => {
        const t = teorico.get(id) ?? 0;
        const r = real.get(id) ?? 0;
        const diff = r - t;
        return {
          id_insumo: id,
          nombre: nombres.get(id) ?? "—",
          teorico: t,
          real: r,
          diferencia: diff,
          diferencia_pct: t > 0 ? (diff / t) * 100 : 0,
        };
      })
      .filter((d) => Math.abs(d.diferencia_pct) >= 5 && (d.teorico > 0 || d.real > 0))
      .sort((a, b) => Math.abs(b.diferencia_pct) - Math.abs(a.diferencia_pct))
      .slice(0, 15);

    return {
      items_cancelados: cancelados ?? 0,
      cuello_botella: enCola ?? 0,
      cuello_umbral: 10,
      desviaciones,
    };
  });
