// Bodega/inventario vía REST.
import { api } from "./api-client";

export function ajustarStock(input: {
  idInsumo: string;
  nuevaCantidad: number;
  motivo: string;
  idBodega: string;
}) {
  return api.post<{ ok: true }>("/bodega/ajustar-stock", input);
}

export interface CompraInput {
  idProveedor: string;
  numeroFactura?: string;
  observaciones?: string;
  fechaCompra: string;
  idBodegaDefault: string;
  items: Array<{
    id_insumo: string;
    cantidad: number;
    precio_unitario_compra: number;
    id_bodega_destino?: string | null;
  }>;
}
export function registrarCompra(input: CompraInput) {
  return api.post<{ idCompra: string }>("/bodega/compras", input);
}

export function trasladarInventario(input: {
  idInsumo: string;
  idBodegaOrigen: string;
  idBodegaDestino: string;
  cantidad: number;
  motivo?: string;
}) {
  return api.post<{ ok: true }>("/bodega/trasladar", input);
}

export function eliminarBodega(idBodega: string) {
  return api.post<{ ok: true }>(`/bodega/bodegas/${idBodega}/eliminar`);
}

export function setBodegaPrincipalEspacio(idEspacio: string, idBodega: string) {
  return api.post<{ ok: true }>(`/bodega/espacios/${idEspacio}/bodega-principal`, { idBodega });
}

export function listarInsumos() {
  return api.get<Array<Record<string, unknown>>>("/bodega/insumos");
}
export function listarBodegas() {
  return api.get<Array<Record<string, unknown>>>("/bodega/bodegas");
}
export function listarProveedores() {
  return api.get<Array<Record<string, unknown>>>("/bodega/proveedores");
}

// Historial de inventario + compras (lecturas de detalle).
export function listarMovimientos(limit = 50) {
  return api.get<{ movimientos: Array<Record<string, unknown>>; hasMore: boolean }>(
    `/bodega/movimientos?limit=${limit}`,
  );
}
export function listarCompras() {
  return api.get<Array<Record<string, unknown>>>("/bodega/compras");
}
export function getCompraDetalle(idCompra: string) {
  return api.get<{
    compra: Record<string, unknown> | null;
    detalles: Array<Record<string, unknown>>;
  }>(`/bodega/compras/${idCompra}`);
}

// Inventario por bodega (desglose) + detalle por insumo.
export function listarInventarioBodega() {
  return api.get<Array<Record<string, unknown>>>("/bodega/inventario-bodega");
}
export function getInsumo(idInsumo: string) {
  return api.get<{ insumo: Record<string, unknown>; cantidad_actual: number }>(
    `/bodega/insumos/${idInsumo}`,
  );
}
export function getStockPorBodega(idInsumo: string) {
  return api.get<Array<{ id_bodega: string; cantidad_actual: number }>>(
    `/bodega/insumos/${idInsumo}/stock-por-bodega`,
  );
}
export function getComprasDeInsumo(idInsumo: string) {
  return api.get<Array<Record<string, unknown>>>(`/bodega/insumos/${idInsumo}/compras`);
}
export function getMovimientosDeInsumo(idInsumo: string) {
  return api.get<Array<Record<string, unknown>>>(`/bodega/insumos/${idInsumo}/movimientos`);
}
export function eliminarInsumo(idInsumo: string) {
  return api.del<{ ok: true }>(`/bodega/insumos/${idInsumo}`);
}

// CRUD de insumos.
export interface InsumoInput {
  nombre_insumo: string;
  costo_promedio: number;
  stock_minimo: number;
  unidad_compra: string;
  unidad_receta: string;
  factor_conversion: number;
}
export function crearInsumo(input: InsumoInput) {
  return api.post<{ id_insumo: string }>("/bodega/insumos", input);
}
export function actualizarInsumo(idInsumo: string, patch: Partial<InsumoInput>) {
  return api.patch<{ ok: true }>(`/bodega/insumos/${idInsumo}`, patch);
}

// CRUD de proveedores.
export interface ProveedorInput {
  razon_social: string;
  documento_tributario: string;
  nombre_contacto: string;
  telefono: string;
  estado: boolean;
}
export function crearProveedor(input: ProveedorInput) {
  return api.post<{ id_proveedor: string }>("/bodega/proveedores", input);
}
export function actualizarProveedor(idProveedor: string, patch: Partial<ProveedorInput>) {
  return api.patch<{ ok: true }>(`/bodega/proveedores/${idProveedor}`, patch);
}
export function eliminarProveedor(idProveedor: string) {
  return api.del<{ ok: true }>(`/bodega/proveedores/${idProveedor}`);
}
