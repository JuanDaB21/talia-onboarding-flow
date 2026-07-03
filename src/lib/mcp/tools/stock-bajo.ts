import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import {
  getStaffContext,
  jsonResult,
  notAuthenticatedResult,
} from "../staff-context";

export default defineTool({
  name: "get_stock_bajo",
  title: "Insumos con stock bajo",
  description:
    "Devuelve los insumos cuyo stock actual está por debajo del mínimo configurado.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    const staff = await getStaffContext(ctx);
    if (!staff) return notAuthenticatedResult();
    const { data: insumos } = await staff.supabase
      .from("insumos")
      .select("id_insumo, nombre_insumo, stock_minimo, unidad_compra, factor_conversion")
      .eq("id_negocio", staff.idNegocio);
    const { data: inv } = await staff.supabase
      .from("inventario_actual")
      .select("id_insumo, cantidad_actual")
      .eq("id_negocio", staff.idNegocio);
    const invMap = new Map(
      (inv ?? []).map((i) => [i.id_insumo, Number(i.cantidad_actual)]),
    );
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
      .sort(
        (a, b) =>
          a.actual / Math.max(1, a.minimo) - b.actual / Math.max(1, b.minimo),
      );
    return jsonResult({ insumos_bajo_minimo: bajos });
  },
});
