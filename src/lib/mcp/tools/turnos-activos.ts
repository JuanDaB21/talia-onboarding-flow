import { defineTool } from "@lovable.dev/mcp-js";
import {
  getStaffContext,
  jsonResult,
  notAuthenticatedResult,
} from "../staff-context";

export default defineTool({
  name: "get_turnos_activos",
  title: "Personal en turno",
  description: "Devuelve el staff que actualmente tiene turno abierto.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    const staff = await getStaffContext(ctx);
    if (!staff) return notAuthenticatedResult();
    const { data } = await staff.supabase
      .from("turnos_staff")
      .select("iniciado_at, usuarios_staff:id_usuario(nombre, rol)")
      .eq("id_negocio", staff.idNegocio)
      .is("finalizado_at", null);
    return jsonResult({
      en_turno: (data ?? []).map((t) => ({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        nombre: ((t as any).usuarios_staff?.nombre as string) ?? "—",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        rol: ((t as any).usuarios_staff?.rol as string) ?? "—",
        desde: t.iniciado_at,
      })),
    });
  },
});
