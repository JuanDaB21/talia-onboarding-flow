import { createFileRoute } from "@tanstack/react-router";
import {
  convertToModelMessages,
  streamText,
  tool,
  stepCountIs,
  type UIMessage,
} from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

type ChatRequestBody = { messages?: unknown };

async function getAuthedStaff(request: Request) {
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;

  const { createClient } = await import("@supabase/supabase-js");
  const url = process.env.SUPABASE_URL!;
  const anon = process.env.SUPABASE_PUBLISHABLE_KEY!;
  const sb = createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error } = await sb.auth.getUser(token);
  if (error || !userData.user) return null;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: staff } = await supabaseAdmin
    .from("usuarios_staff")
    .select("id_usuario, id_negocio, rol, nombre, correo")
    .eq("id_usuario", userData.user.id)
    .maybeSingle();
  if (!staff?.id_negocio) return null;

  const { data: negocio } = await supabaseAdmin
    .from("negocio")
    .select("nombre_comercial, timezone")
    .eq("id_negocio", staff.id_negocio)
    .maybeSingle();

  return { staff, negocio, supabaseAdmin };
}

function isAdminRol(rol: string | null | undefined) {
  return rol === "ADMIN" || rol === "SUPERADMIN";
}

function buildTools(idNegocio: string) {
  // Lazy import inside tools to keep this top-level light
  const adminPromise = import("@/integrations/supabase/client.server").then(
    (m) => m.supabaseAdmin,
  );

  return {
    get_ventas_resumen: tool({
      description:
        "Resumen de ventas del negocio en un rango de fechas (ingresos, número de pedidos pagados, ticket promedio).",
      inputSchema: z.object({
        desde: z.string().describe("Fecha ISO de inicio, ej. 2026-06-01T00:00:00Z"),
        hasta: z.string().describe("Fecha ISO de fin, ej. 2026-06-10T23:59:59Z"),
      }),
      execute: async ({ desde, hasta }) => {
        const sb = await adminPromise;
        const { data } = await sb
          .from("pedidos")
          .select("id_pedido, total, estado, created_at")
          .eq("id_negocio", idNegocio)
          .eq("estado", "PAGADO")
          .gte("created_at", desde)
          .lte("created_at", hasta);
        const pedidos = data ?? [];
        const total = pedidos.reduce((s, p) => s + Number(p.total ?? 0), 0);
        const count = pedidos.length;
        return {
          ingresos_totales: total,
          pedidos_pagados: count,
          ticket_promedio: count > 0 ? total / count : 0,
        };
      },
    }),
    get_productos_top: tool({
      description: "Productos más vendidos en un rango de fechas.",
      inputSchema: z.object({
        desde: z.string(),
        hasta: z.string(),
        limit: z.number().int().min(1).max(20).default(5),
      }),
      execute: async ({ desde, hasta, limit }) => {
        const sb = await adminPromise;
        const { data: peds } = await sb
          .from("pedidos")
          .select("id_pedido")
          .eq("id_negocio", idNegocio)
          .in("estado", ["CONFIRMADO", "PAGADO"])
          .gte("created_at", desde)
          .lte("created_at", hasta);
        const ids = (peds ?? []).map((p) => p.id_pedido);
        if (ids.length === 0) return { productos: [] };
        const { data: items } = await sb
          .from("pedido_items")
          .select("id_producto, cantidad, productos:id_producto(nombre_producto)")
          .in("id_pedido", ids);
        const map = new Map<string, { nombre: string; cantidad: number }>();
        for (const it of items ?? []) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const nombre = ((it as any).productos?.nombre_producto as string) ?? "—";
          const prev = map.get(it.id_producto) ?? { nombre, cantidad: 0 };
          prev.cantidad += Number(it.cantidad);
          map.set(it.id_producto, prev);
        }
        const productos = Array.from(map.values())
          .sort((a, b) => b.cantidad - a.cantidad)
          .slice(0, limit);
        return { productos };
      },
    }),
    get_stock_bajo: tool({
      description: "Insumos cuyo stock actual está por debajo del mínimo configurado.",
      inputSchema: z.object({}),
      execute: async () => {
        const sb = await adminPromise;
        const { data: insumos } = await sb
          .from("insumos")
          .select("id_insumo, nombre_insumo, stock_minimo, unidad_compra, factor_conversion")
          .eq("id_negocio", idNegocio);
        const { data: inv } = await sb
          .from("inventario_actual")
          .select("id_insumo, cantidad_actual")
          .eq("id_negocio", idNegocio);
        const invMap = new Map((inv ?? []).map((i) => [i.id_insumo, Number(i.cantidad_actual)]));
        const bajos = (insumos ?? [])
          .map((i) => {
            const factor = Number(i.factor_conversion ?? 1) || 1;
            const cantidadReceta = invMap.get(i.id_insumo) ?? 0;
            const actualCompra = cantidadReceta / factor;
            return {
              nombre: i.nombre_insumo,
              actual: actualCompra,
              minimo: Number(i.stock_minimo ?? 0),
              unidad: i.unidad_compra,
            };
          })
          .filter((x) => x.minimo > 0 && x.actual < x.minimo)
          .sort((a, b) => a.actual / Math.max(1, a.minimo) - b.actual / Math.max(1, b.minimo));
        return { insumos_bajo_minimo: bajos };
      },
    }),
    get_mesas_estado: tool({
      description: "Estado actual de todas las mesas (libre, ocupada, etc.) y solicitudes activas.",
      inputSchema: z.object({}),
      execute: async () => {
        const sb = await adminPromise;
        const { data } = await sb
          .from("mesas")
          .select("identificador, estado, solicitud_cliente, solicitud_at")
          .eq("id_negocio", idNegocio)
          .order("identificador");
        const mesas = data ?? [];
        const resumen = mesas.reduce<Record<string, number>>((acc, m) => {
          acc[m.estado] = (acc[m.estado] ?? 0) + 1;
          return acc;
        }, {});
        return { resumen_por_estado: resumen, mesas };
      },
    }),
    get_pedidos_activos: tool({
      description: "Pedidos activos (no pagados) con su mesa y total.",
      inputSchema: z.object({}),
      execute: async () => {
        const sb = await adminPromise;
        const { data } = await sb
          .from("pedidos")
          .select("id_pedido, estado, total, created_at, mesas:id_mesa(identificador)")
          .eq("id_negocio", idNegocio)
          .neq("estado", "PAGADO")
          .order("created_at", { ascending: false })
          .limit(50);
        return {
          pedidos: (data ?? []).map((p) => ({
            estado: p.estado,
            total: Number(p.total ?? 0),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            mesa: ((p as any).mesas?.identificador as string) ?? "—",
            creado: p.created_at,
          })),
        };
      },
    }),
    get_turnos_activos: tool({
      description: "Staff actualmente en turno.",
      inputSchema: z.object({}),
      execute: async () => {
        const sb = await adminPromise;
        const { data } = await sb
          .from("turnos_staff")
          .select("iniciado_at, usuarios_staff:id_usuario(nombre, rol)")
          .eq("id_negocio", idNegocio)
          .is("finalizado_at", null);
        return {
          en_turno: (data ?? []).map((t) => ({
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            nombre: ((t as any).usuarios_staff?.nombre as string) ?? "—",
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            rol: ((t as any).usuarios_staff?.rol as string) ?? "—",
            desde: t.iniciado_at,
          })),
        };
      },
    }),
    get_caja_dia: tool({
      description: "Estado de la caja del día actual (abierta o cerrada).",
      inputSchema: z.object({}),
      execute: async () => {
        const sb = await adminPromise;
        const { data } = await sb
          .from("caja_dia")
          .select("fecha, estado, base_inicial, efectivo_sistema, transferencia_sistema, datafono_sistema, abierta_at, cerrada_at")
          .eq("id_negocio", idNegocio)
          .order("fecha", { ascending: false })
          .limit(1)
          .maybeSingle();
        return data ?? { mensaje: "No hay cajas registradas." };
      },
    }),
    buscar_producto: tool({
      description: "Busca productos del menú por coincidencia parcial en el nombre.",
      inputSchema: z.object({ query: z.string().min(1) }),
      execute: async ({ query }) => {
        const sb = await adminPromise;
        const { data } = await sb
          .from("productos")
          .select("nombre_producto, precio_venta, descripcion_producto, activo")
          .eq("id_negocio", idNegocio)
          .ilike("nombre_producto", `%${query}%`)
          .limit(20);
        return { productos: data ?? [] };
      },
    }),
  };
}

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        const authed = await getAuthedStaff(request);
        if (!authed) return new Response("Unauthorized", { status: 401 });
        if (!isAdminRol(authed.staff.rol)) return new Response("Forbidden", { status: 403 });


        const { messages } = (await request.json()) as ChatRequestBody;
        if (!Array.isArray(messages)) {
          return new Response("Messages are required", { status: 400 });
        }

        const gateway = createLovableAiGatewayProvider(key);
        const model = gateway("google/gemini-3-flash-preview");

        const negocioNombre = authed.negocio?.nombre_comercial ?? "el restaurante";
        const rol = authed.staff.rol;
        const nombre = authed.staff.nombre ?? "usuario";
        const ahora = new Date().toISOString();

        const system = `Eres Talia, asistente IA del restaurante "${negocioNombre}". Hablas con ${nombre} (rol: ${rol}). Fecha y hora actual: ${ahora}.

Reglas:
- Responde siempre en español, de forma concisa y directa.
- Antes de responder con datos, usa las herramientas disponibles para obtener información actualizada del negocio. No inventes cifras.
- Para preguntas como "hoy", "ayer", "esta semana", calcula tú las fechas ISO y pásalas a las herramientas.
- Si la pregunta no requiere datos (saludos, preguntas generales sobre la app), responde directamente.
- Formato: usa listas y negritas cuando ayude a la lectura. Sé breve.
- Solo lectura: no puedes crear pedidos, cerrar mesas, ni modificar nada. Si te lo piden, explícalo amablemente.`;

        const result = streamText({
          model,
          system,
          messages: await convertToModelMessages(messages as UIMessage[]),
          tools: buildTools(authed.staff.id_negocio),
          stopWhen: stepCountIs(50),
        });

        return result.toUIMessageStreamResponse({
          originalMessages: messages as UIMessage[],
        });
      },
    },
  },
});
