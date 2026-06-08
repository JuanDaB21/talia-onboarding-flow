import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface KpisHoy {
  ventas_dia: number;
  ticket_promedio: number;
  mesas_cerradas: number;
  ocupacion_pct: number;
  mesas_totales: number;
  mesas_ocupadas: number;
  tiempo_prep_real_min: number | null;
  tiempo_prep_planeado_min: number | null;
}

export const getKpisHoy = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<KpisHoy> => {
    const { supabase } = context;
    const desde = new Date();
    desde.setHours(0, 0, 0, 0);
    const desdeIso = desde.toISOString();

    // Ventas del día (pagos confirmados)
    const { data: pagos } = await supabase
      .from("pagos")
      .select("monto, id_mesa, estado_confirmacion, created_at")
      .eq("estado_confirmacion", "CONFIRMADO")
      .gte("created_at", desdeIso);
    const ventas_dia = (pagos ?? []).reduce((a, p) => a + Number(p.monto), 0);

    // Mesas cerradas hoy = pedidos PAGADOS hoy con id_mesa distinto
    const { data: pedidosPag } = await supabase
      .from("pedidos")
      .select("id_mesa, pagado_at")
      .eq("estado", "PAGADO")
      .gte("pagado_at", desdeIso);
    const mesasSet = new Set((pedidosPag ?? []).map((p) => p.id_mesa));
    const mesas_cerradas = mesasSet.size;
    const ticket_promedio = mesas_cerradas > 0 ? ventas_dia / mesas_cerradas : 0;

    // Ocupación actual
    const { data: mesas } = await supabase.from("mesas").select("estado");
    const mesas_totales = mesas?.length ?? 0;
    const mesas_ocupadas = (mesas ?? []).filter((m) => m.estado !== "LIBRE").length;
    const ocupacion_pct = mesas_totales > 0 ? (mesas_ocupadas / mesas_totales) * 100 : 0;

    // Tiempo prep real vs planeado (items listos hoy)
    const { data: items } = await supabase
      .from("pedido_items")
      .select("iniciado_at, listo_at, tiempo_planeado_min")
      .gte("listo_at", desdeIso)
      .not("iniciado_at", "is", null);
    let sumReal = 0;
    let sumPlan = 0;
    let count = 0;
    for (const it of items ?? []) {
      if (!it.iniciado_at || !it.listo_at) continue;
      const real = (new Date(it.listo_at).getTime() - new Date(it.iniciado_at).getTime()) / 60000;
      sumReal += real;
      sumPlan += Number(it.tiempo_planeado_min ?? 0);
      count++;
    }
    const tiempo_prep_real_min = count > 0 ? sumReal / count : null;
    const tiempo_prep_planeado_min = count > 0 ? sumPlan / count : null;

    return {
      ventas_dia,
      ticket_promedio,
      mesas_cerradas,
      ocupacion_pct,
      mesas_totales,
      mesas_ocupadas,
      tiempo_prep_real_min,
      tiempo_prep_planeado_min,
    };
  });

export interface AlertaItem {
  id_item: string;
  id_mesa: string | null;
  identificador_mesa: string;
  producto: string;
  destino: string | null;
  estado_preparacion: string;
  minutos_transcurridos: number;
  minutos_planeados: number;
  retraso_min: number;
}

export const getAlertasOperacion = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ alertas: AlertaItem[] }> => {
    const { supabase } = context;
    const { data: items } = await supabase
      .from("pedido_items")
      .select(
        "id_item, id_pedido, destino, estado_preparacion, iniciado_at, tiempo_planeado_min, productos:id_producto(nombre_producto), pedidos:id_pedido(id_mesa, confirmado_at, created_at)",
      )
      .in("estado_preparacion", ["EN_COLA", "EN_PREPARACION"]);

    const mesaIds = Array.from(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      new Set((items ?? []).map((i: any) => i.pedidos?.id_mesa).filter(Boolean) as string[]),
    );
    const mesasMap = new Map<string, string>();
    if (mesaIds.length > 0) {
      const { data: ms } = await supabase
        .from("mesas")
        .select("id_mesa, identificador")
        .in("id_mesa", mesaIds);
      (ms ?? []).forEach((m) => mesasMap.set(m.id_mesa, m.identificador));
    }

    const ahora = Date.now();
    const alertas: AlertaItem[] = [];
    for (const it of items ?? []) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const anyIt = it as any;
      const planeado = Number(it.tiempo_planeado_min ?? 0);
      if (planeado <= 0) continue;
      const refIso =
        it.estado_preparacion === "EN_PREPARACION"
          ? it.iniciado_at
          : anyIt.pedidos?.confirmado_at ?? anyIt.pedidos?.created_at;
      if (!refIso) continue;
      const trans = (ahora - new Date(refIso).getTime()) / 60000;
      if (trans > planeado * 1.2) {
        alertas.push({
          id_item: it.id_item,
          id_mesa: (anyIt.pedidos?.id_mesa as string | undefined) ?? null,
          identificador_mesa: mesasMap.get(anyIt.pedidos?.id_mesa) ?? "—",
          producto: anyIt.productos?.nombre_producto ?? "—",
          destino: (it.destino as string | null) ?? null,
          estado_preparacion: it.estado_preparacion as string,
          minutos_transcurridos: Math.round(trans),
          minutos_planeados: planeado,
          retraso_min: Math.round(trans - planeado),
        });
      }
    }
    alertas.sort((a, b) => b.retraso_min - a.retraso_min);
    return { alertas };
  });

export interface StaffEnTurno {
  id_usuario: string;
  nombre: string;
  rol: string;
  turno_iniciado_at: string | null;
  mesas_asignadas: number;
}

export const getPersonalEnTurno = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ staff: StaffEnTurno[] }> => {
    const { supabase } = context;
    const { data: staff } = await supabase
      .from("usuarios_staff")
      .select("id_usuario, nombre, rol, turno_iniciado_at")
      .eq("esta_en_turno", true);

    const meseros = (staff ?? []).filter((s) => s.rol === "MESERO").map((s) => s.id_usuario);
    const cargaMap = new Map<string, number>();
    if (meseros.length > 0) {
      const { data: ms } = await supabase
        .from("mesas")
        .select("id_mesero_asignado")
        .in("id_mesero_asignado", meseros)
        .neq("estado", "LIBRE");
      (ms ?? []).forEach((m) => {
        const k = m.id_mesero_asignado as string;
        cargaMap.set(k, (cargaMap.get(k) ?? 0) + 1);
      });
    }

    const out: StaffEnTurno[] = (staff ?? []).map((s) => ({
      id_usuario: s.id_usuario,
      nombre: s.nombre,
      rol: s.rol as string,
      turno_iniciado_at: s.turno_iniciado_at as string | null,
      mesas_asignadas: cargaMap.get(s.id_usuario) ?? 0,
    }));
    out.sort((a, b) => a.rol.localeCompare(b.rol) || a.nombre.localeCompare(b.nombre));
    return { staff: out };
  });

export interface MesaOperacion {
  id_mesa: string;
  identificador: string;
  estado: string;
  mesero_nombre: string | null;
  asignada_at: string | null;
  solicitud_cliente: string | null;
  solicitud_at: string | null;
}

export const getMesasOperacion = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ mesas: MesaOperacion[] }> => {
    const { supabase } = context;
    const { data: mesas } = await supabase
      .from("mesas")
      .select(
        "id_mesa, identificador, estado, id_mesero_asignado, asignada_at, solicitud_cliente, solicitud_at",
      )
      .order("identificador");
    const meseroIds = Array.from(
      new Set((mesas ?? []).map((m) => m.id_mesero_asignado).filter(Boolean) as string[]),
    );
    const nombres = new Map<string, string>();
    if (meseroIds.length > 0) {
      const { data: us } = await supabase
        .from("usuarios_staff")
        .select("id_usuario, nombre")
        .in("id_usuario", meseroIds);
      (us ?? []).forEach((u) => nombres.set(u.id_usuario, u.nombre));
    }
    return {
      mesas: (mesas ?? []).map((m) => ({
        id_mesa: m.id_mesa,
        identificador: m.identificador,
        estado: m.estado as string,
        mesero_nombre: m.id_mesero_asignado ? nombres.get(m.id_mesero_asignado) ?? null : null,
        asignada_at: m.asignada_at as string | null,
        solicitud_cliente: m.solicitud_cliente as string | null,
        solicitud_at: m.solicitud_at as string | null,
      })),
    };
  });
