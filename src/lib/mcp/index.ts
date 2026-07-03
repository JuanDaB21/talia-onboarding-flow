import { auth, defineMcp } from "@lovable.dev/mcp-js";
import ventasResumenTool from "./tools/ventas-resumen";
import productosTopTool from "./tools/productos-top";
import stockBajoTool from "./tools/stock-bajo";
import mesasEstadoTool from "./tools/mesas-estado";
import pedidosActivosTool from "./tools/pedidos-activos";
import turnosActivosTool from "./tools/turnos-activos";
import cajaDiaTool from "./tools/caja-dia";
import buscarProductoTool from "./tools/buscar-producto";

// See app-mcp-server-authoring: OAuth issuer must be the direct Supabase host,
// not the .lovable.cloud proxy. Derive from the inlined project ref.
const projectRef =
  import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "talia-mcp",
  title: "Talia — Restaurant Management",
  version: "0.1.0",
  instructions:
    "Herramientas de solo lectura del restaurante gestionado en Talia: ventas, productos más vendidos, stock, mesas, pedidos activos, turnos, caja del día y búsqueda del menú. Todas las consultas se ejecutan como el usuario autenticado y sólo devuelven datos del negocio al que pertenece.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    ventasResumenTool,
    productosTopTool,
    stockBajoTool,
    mesasEstadoTool,
    pedidosActivosTool,
    turnosActivosTool,
    cajaDiaTool,
    buscarProductoTool,
  ],
});
