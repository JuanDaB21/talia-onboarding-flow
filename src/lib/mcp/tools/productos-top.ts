import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import {
  getStaffContext,
  jsonResult,
  notAuthenticatedResult,
} from "../staff-context";

export default defineTool({
  name: "get_productos_top",
  title: "Productos más vendidos",
  description:
    "Lista los productos más vendidos del negocio en un rango de fechas (pedidos confirmados o pagados).",
  inputSchema: {
    desde: z.string(),
    hasta: z.string(),
    limit: z.number().int().min(1).max(20).default(5),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ desde, hasta, limit }, ctx) => {
    const staff = await getStaffContext(ctx);
    if (!staff) return notAuthenticatedResult();
    const { data: peds } = await staff.supabase
      .from("pedidos")
      .select("id_pedido")
      .eq("id_negocio", staff.idNegocio)
      .in("estado", ["CONFIRMADO", "PAGADO"])
      .gte("created_at", desde)
      .lte("created_at", hasta);
    const ids = (peds ?? []).map((p) => p.id_pedido);
    if (ids.length === 0) return jsonResult({ productos: [] });
    const { data: items } = await staff.supabase
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
    return jsonResult({ productos });
  },
});
