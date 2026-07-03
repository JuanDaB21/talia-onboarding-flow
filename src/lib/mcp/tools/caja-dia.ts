import { defineTool } from "@lovable.dev/mcp-js";
import {
  getStaffContext,
  jsonResult,
  notAuthenticatedResult,
} from "../staff-context";

export default defineTool({
  name: "get_caja_dia",
  title: "Estado de la caja del día",
  description: "Devuelve el estado de la caja del día más reciente (abierta o cerrada).",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    const staff = await getStaffContext(ctx);
    if (!staff) return notAuthenticatedResult();
    const { data } = await staff.supabase
      .from("caja_dia")
      .select(
        "fecha, estado, base_inicial, efectivo_sistema, transferencia_sistema, datafono_sistema, abierta_at, cerrada_at",
      )
      .eq("id_negocio", staff.idNegocio)
      .order("fecha", { ascending: false })
      .limit(1)
      .maybeSingle();
    return jsonResult(data ?? { mensaje: "No hay cajas registradas." });
  },
});
