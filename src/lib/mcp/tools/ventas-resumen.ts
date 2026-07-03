import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import {
  getStaffContext,
  jsonResult,
  notAuthenticatedResult,
} from "../staff-context";

export default defineTool({
  name: "get_ventas_resumen",
  title: "Resumen de ventas",
  description:
    "Devuelve ingresos totales, número de pedidos pagados y ticket promedio del negocio del usuario en un rango de fechas ISO.",
  inputSchema: {
    desde: z.string().describe("Fecha ISO de inicio, ej. 2026-06-01T00:00:00Z"),
    hasta: z.string().describe("Fecha ISO de fin, ej. 2026-06-30T23:59:59Z"),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ desde, hasta }, ctx) => {
    const staff = await getStaffContext(ctx);
    if (!staff) return notAuthenticatedResult();
    const { data, error } = await staff.supabase
      .from("pedidos")
      .select("total, estado, created_at")
      .eq("id_negocio", staff.idNegocio)
      .eq("estado", "PAGADO")
      .gte("created_at", desde)
      .lte("created_at", hasta);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    const pedidos = data ?? [];
    const total = pedidos.reduce((s, p) => s + Number(p.total ?? 0), 0);
    const count = pedidos.length;
    return jsonResult({
      ingresos_totales: total,
      pedidos_pagados: count,
      ticket_promedio: count > 0 ? total / count : 0,
    });
  },
});
