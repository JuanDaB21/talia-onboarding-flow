import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import {
  getStaffContext,
  jsonResult,
  notAuthenticatedResult,
} from "../staff-context";

export default defineTool({
  name: "buscar_producto",
  title: "Buscar productos del menú",
  description: "Busca productos del menú por coincidencia parcial en el nombre.",
  inputSchema: {
    query: z.string().min(1).describe("Texto a buscar en el nombre del producto"),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ query }, ctx) => {
    const staff = await getStaffContext(ctx);
    if (!staff) return notAuthenticatedResult();
    const { data } = await staff.supabase
      .from("productos")
      .select("nombre_producto, precio_venta, descripcion_producto, activo")
      .eq("id_negocio", staff.idNegocio)
      .ilike("nombre_producto", `%${query}%`)
      .limit(20);
    return jsonResult({ productos: data ?? [] });
  },
});
