import { defineTool } from "@lovable.dev/mcp-js";
import {
  getStaffContext,
  jsonResult,
  notAuthenticatedResult,
} from "../staff-context";

export default defineTool({
  name: "get_pedidos_activos",
  title: "Pedidos activos",
  description: "Devuelve los pedidos actualmente activos (no pagados) con su mesa y total.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    const staff = await getStaffContext(ctx);
    if (!staff) return notAuthenticatedResult();
    const { data } = await staff.supabase
      .from("pedidos")
      .select("id_pedido, estado, total, created_at, mesas:id_mesa(identificador)")
      .eq("id_negocio", staff.idNegocio)
      .neq("estado", "PAGADO")
      .order("created_at", { ascending: false })
      .limit(50);
    return jsonResult({
      pedidos: (data ?? []).map((p) => ({
        estado: p.estado,
        total: Number(p.total ?? 0),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        mesa: ((p as any).mesas?.identificador as string) ?? "—",
        creado: p.created_at,
      })),
    });
  },
});
