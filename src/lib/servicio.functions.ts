// Data-access de servicio (mesero) vía REST del backend Talia.
// Mismas firmas que el original (Supabase) para minimizar cambios en los componentes.
import { api } from "@/lib/api-client";
import type { PrepedidoData } from "@/lib/prepedido.functions";

export interface MesaServicio {
  id_mesa: string;
  identificador: string;
  estado: string;
  id_mesero_asignado: string | null;
  asignada_at: string | null;
  mesero_nombre: string | null;
  solicitud_cliente: string | null;
  solicitud_at: string | null;
  alerta_listo: boolean;
  alerta_seguimiento: boolean;
  tiene_prepedido: boolean;
}

// GET /servicio/mesas → agregación (alertas, nombre mesero, filtro por rol) en el backend.
export function listarMesasServicio() {
  return api.get<{ mesas: MesaServicio[]; esAdmin: boolean; userId: string }>("/servicio/mesas");
}

// Abrir una mesa LIBRE. Si no se pasa idMesero, el backend autoasigna al llamante (mesero).
export function abrirMesa(input: { idMesa: string; idMesero?: string | null }) {
  return api.post<{ idMesero: string }>(`/servicio/mesas/${input.idMesa}/abrir`, {
    idMesero: input.idMesero ?? null,
  });
}

export function iniciarNuevoPedido(idMesa: string) {
  return api.post<{ ok: true; result: string | null }>(`/servicio/mesas/${idMesa}/nuevo-pedido`);
}

export function confirmarPedido(idPedido: string) {
  return api.post<{ ok: true; result: unknown }>(`/servicio/pedidos/${idPedido}/confirmar`);
}

export async function marcarPedidoEntregado(idPedido: string) {
  const r = await api.post<{ ok: true; result: number | null }>(
    `/servicio/pedidos/${idPedido}/entregar`,
  );
  return { entregados: Number(r.result ?? 0) };
}

export function marcarSeguimientoVisto(idPedido: string) {
  return api.post<{ ok: true; result: unknown }>(`/servicio/pedidos/${idPedido}/seguimiento-visto`);
}

export function eliminarItem(idItem: string) {
  return api.post<{ ok: true; result: unknown }>(`/servicio/items/${idItem}/eliminar`);
}

export function limpiarSolicitudCliente(input: { idMesa: string }) {
  return api.post<{ ok: true; result: number | null }>(
    `/servicio/mesas/${input.idMesa}/limpiar-solicitud`,
  );
}

export function tomarPedidoLlamado(idMesa: string) {
  return api.post<{ ok: true }>(`/servicio/mesas/${idMesa}/tomar-pedido`);
}

export function detenerAlertaLlamado(idMesa: string) {
  return api.post<{ ok: true }>(`/servicio/mesas/${idMesa}/detener-alerta`);
}

// Listar meseros activos del negocio (para asignación/reasignación) → GET /servicio/meseros
export function listarMeserosNegocio() {
  return api.get<Array<{ id_usuario: string; nombre: string; esta_en_turno: boolean }>>(
    "/servicio/meseros",
  );
}

// Reasignar mesero a una mesa → POST /servicio/mesas/:id/reasignar (validación en el backend)
export function reasignarMeseroMesa(input: { idMesa: string; idMesero: string }) {
  return api.post<{ ok: true }>(`/servicio/mesas/${input.idMesa}/reasignar`, {
    idMesero: input.idMesero,
  });
}

// ── Armar pedido (catálogo + opciones + agregar/editar item) ──

export interface CatalogoProducto {
  id_producto: string;
  nombre_producto: string;
  descripcion_producto: string | null;
  precio_venta: number;
  url_imagen: string | null;
  id_receta: string;
  id_categoria: string;
}

export interface CatalogoCategoria {
  id_categoria: string;
  nombre: string;
  destino: string | null;
}

export function getCatalogoServicio() {
  return api.get<{ productos: CatalogoProducto[]; categorias: CatalogoCategoria[] }>(
    "/servicio/catalogo",
  );
}

export interface OpcionExtra {
  id_insumo_extra: string;
  cantidad_porcion: number;
  precio_extra: number;
  nombre_insumo: string;
  unidad_receta: string;
}
export interface OpcionIngrediente {
  id_insumo: string;
  cantidad: number;
  nombre_insumo: string;
  unidad_receta: string;
}
export interface OpcionVarianteOpcion {
  id_opcion: string;
  id_insumo_opcion: string;
  nombre_opcion: string;
  unidad_receta: string;
  cantidad_porcion: number;
  precio_delta: number;
}
export interface OpcionVarianteGrupo {
  id_grupo: string;
  nombre: string;
  seleccion: "UNICA" | "MULTIPLE";
  opciones: OpcionVarianteOpcion[];
}
export interface OpcionesProducto {
  extras: OpcionExtra[];
  ingredientes: OpcionIngrediente[];
  variantes: OpcionVarianteGrupo[];
}

export function getOpcionesProducto(idProducto: string) {
  return api.get<OpcionesProducto>(`/servicio/productos/${idProducto}/opciones`);
}

export interface AgregarItemInput {
  idPedido: string;
  idProducto: string;
  cantidad: number;
  tieneAlergia: boolean;
  nota?: string | null;
  extras?: Array<{ id_insumo_extra: string }>;
  exclusiones?: Array<{ id_insumo: string }>;
  variantes?: Array<{ id_opcion: string }>;
}

export function agregarItem({ idPedido, ...body }: AgregarItemInput) {
  return api.post<{ ok: true }>(`/servicio/pedidos/${idPedido}/items`, body);
}

export function editarItem(input: {
  idItem: string;
  cantidad: number;
  tieneAlergia: boolean;
  nota?: string | null;
}) {
  const { idItem, ...body } = input;
  return api.patch<{ ok: true }>(`/servicio/items/${idItem}`, body);
}

// ── Mesa en sesión (multi-pedido) ──

export interface ItemPedidoSesion {
  id_item: string;
  id_producto: string;
  nombre_producto: string;
  cantidad: number;
  precio_unitario: number;
  tiene_alergia: boolean;
  nota: string | null;
  destino: string | null;
  estado_preparacion: string;
  iniciado_at: string | null;
  listo_at: string | null;
  entregado_at: string | null;
  extras: { id_insumo_extra: string; nombre: string; precio: number }[];
  exclusiones: { id_insumo: string; nombre: string }[];
  variantes: {
    id_opcion: string;
    nombre_grupo: string;
    nombre_opcion: string;
    precio_delta: number;
  }[];
}

export interface PedidoSesion {
  id_pedido: string;
  estado: string;
  total: number;
  created_at: string;
  confirmado_at: string | null;
  entregado_at: string | null;
  pagado_at: string | null;
  seguimiento_visto_at: string | null;
  estado_global: "ABIERTO" | "EN_COLA" | "EN_PREPARACION" | "LISTO" | "ENTREGADO";
  items: ItemPedidoSesion[];
}

export interface MesaSesion {
  id_mesa: string;
  identificador: string;
  estado: string;
  id_mesero_asignado: string | null;
  mesero_nombre: string | null;
  asignada_at: string | null;
  solicitud_cliente: string | null;
  solicitud_at: string | null;
  tiempo_servicio_min: number;
  total_mesa: number;
  pedidos: PedidoSesion[];
}

// POST /servicio/mesas/:id/sesion — el backend asegura un pedido ABIERTO y devuelve el
// shape completo (estado_global, total_mesa, tiempo_servicio_min).
export function obtenerMesaSesion(idMesa: string) {
  return api.post<MesaSesion>(`/servicio/mesas/${idMesa}/sesion`);
}

// ── Pre-pedido en vivo (vista mesero) — GET /prepedido/mesas/:id (autenticado) ──
export function getPrepedidoMesa(idMesa: string): Promise<PrepedidoData> {
  return api.get<PrepedidoData>(`/prepedido/mesas/${idMesa}`);
}
