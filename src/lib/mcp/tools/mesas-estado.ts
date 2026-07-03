import { defineTool } from "@lovable.dev/mcp-js";
import {
  getStaffContext,
  jsonResult,
  notAuthenticatedResult,
} from "../staff-context";

export default defineTool({
  name: "get_mesas_estado",
  title: "Estado de mesas",
  description:
    "Devuelve el estado actual de todas las mesas y un resumen agregado por estado.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    const staff = await getStaffContext(ctx);
    if (!staff) return notAuthenticatedResult();
    const { data } = await staff.supabase
      .from("mesas")
      .select("identificador, estado, solicitud_cliente, solicitud_at")
      .eq("id_negocio", staff.idNegocio)
      .order("identificador");
    const mesas = data ?? [];
    const resumen = mesas.reduce<Record<string, number>>((acc, m) => {
      acc[m.estado] = (acc[m.estado] ?? 0) + 1;
      return acc;
    }, {});
    return jsonResult({ resumen_por_estado: resumen, mesas });
  },
});
