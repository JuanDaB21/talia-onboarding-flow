// Prepedido del comensal (carta pública) y vista mesero, vía REST del backend Talia.
// Flujo público → /prepedido/public/* (endpoints sin auth, funciones SECURITY DEFINER).
// Aceptar prepedido (staff) → /prepedido/mesas/:id/aceptar.
// Staff edita/elimina item de OTRO comensal → /prepedido/items/:id (PATCH) y
// /prepedido/items/:id/eliminar (POST), autenticados (backend 0006).
import { api } from "@/lib/api-client";

// ============================================================
// Tipos
// ============================================================

export interface PrepedidoSesion {
  id_sesion: string;
  id_cliente: string;
  nombre: string;
  created_at: string;
  last_seen_at: string;
}

export interface PrepedidoExtra {
  id_insumo_extra: string;
  nombre: string;
  precio: number;
}

export interface PrepedidoExclusion {
  id_insumo: string;
  nombre: string;
}

export interface PrepedidoVariante {
  id_opcion: string;
  id_grupo: string;
  nombre_grupo: string;
  nombre_opcion: string;
  precio_delta: number;
}

export interface PrepedidoItem {
  id_prepedido_item: string;
  id_sesion: string;
  id_cliente: string;
  nombre_cliente: string;
  id_producto: string;
  nombre_producto: string;
  cantidad: number;
  precio_unitario: number;
  tiene_alergia: boolean;
  nota: string | null;
  extras: PrepedidoExtra[];
  exclusiones: PrepedidoExclusion[];
  variantes: PrepedidoVariante[];
  subtotal: number;
  created_at: string;
}

export interface PrepedidoData {
  sesiones: PrepedidoSesion[];
  items: PrepedidoItem[];
  total: number;
}

// Opciones del producto para el editor del comensal (shapes aplanados por el backend).
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
  /** Si es false, la receta no permite quitar ingredientes (se oculta la sección). */
  permite_quitar_ingredientes: boolean;
}

// ============================================================
// Flujo público (comensal en la mesa, sin login) — /prepedido/public/*
// ============================================================

export function unirseSesionPrepedido(input: {
  idMesa: string;
  idCliente: string;
  nombre: string;
}): Promise<{ id_sesion: string }> {
  return api.post<{ id_sesion: string }>("/prepedido/public/unirse", {
    idMesa: input.idMesa,
    idCliente: input.idCliente,
    nombre: input.nombre.trim(),
  });
}

/**
 * Revalida una sesión de prepedido SIN ocupar la mesa. Usar en el montaje/heartbeat del
 * front (no en el onboarding). Devuelve `id_sesion: null` si la sesión ya no existe en la BD
 * (la cuenta se cerró/pagó) → el llamador debe limpiar el localStorage y volver al onboarding.
 */
export function revalidarSesionPrepedido(input: {
  idMesa: string;
  idCliente: string;
}): Promise<{ id_sesion: string | null }> {
  return api.post<{ id_sesion: string | null }>("/prepedido/public/revalidar", {
    idMesa: input.idMesa,
    idCliente: input.idCliente,
  });
}

export function getPrepedidoPublico(idMesa: string): Promise<PrepedidoData> {
  return api.get<PrepedidoData>(`/prepedido/public/mesas/${idMesa}/estado`);
}

export function getOpcionesProductoPublico(input: {
  idMesa: string;
  idProducto: string;
}): Promise<OpcionesProducto> {
  return api.get<OpcionesProducto>(
    `/prepedido/public/mesas/${input.idMesa}/productos/${input.idProducto}/opciones`,
  );
}

export interface AgregarItemPrepedidoInput {
  idMesa: string;
  idSesion: string;
  idCliente: string;
  idProducto: string;
  cantidad: number;
  tieneAlergia?: boolean;
  nota?: string | null;
  extras: Array<{ id_insumo_extra: string }>;
  exclusiones: Array<{ id_insumo: string }>;
  variantes: Array<{ id_opcion: string }>;
}

export function agregarItemPrepedido(
  input: AgregarItemPrepedidoInput,
): Promise<{ id_prepedido_item: string }> {
  return api.post<{ id_prepedido_item: string }>("/prepedido/public/items", input);
}

export interface EditarItemPrepedidoInput {
  idItem: string;
  idCliente: string;
  cantidad: number;
  tieneAlergia?: boolean;
  nota?: string | null;
  extras: Array<{ id_insumo_extra: string }>;
  exclusiones: Array<{ id_insumo: string }>;
  variantes: Array<{ id_opcion: string }>;
}

export function editarItemPrepedido(input: EditarItemPrepedidoInput): Promise<{ ok: true }> {
  const { idItem, ...body } = input;
  return api.patch<{ ok: true }>(`/prepedido/public/items/${idItem}`, body);
}

export function eliminarItemPrepedido(input: {
  idItem: string;
  idCliente: string;
}): Promise<{ ok: true }> {
  return api.post<{ ok: true }>(`/prepedido/public/items/${input.idItem}/eliminar`, {
    idCliente: input.idCliente,
  });
}

// ============================================================
// Staff — aceptar prepedido (REST autenticado)
// ============================================================

export function aceptarPrepedido(input: { idMesa: string }): Promise<{ aceptados: number }> {
  return api.post<{ aceptados: number }>(`/prepedido/mesas/${input.idMesa}/aceptar`);
}

// ============================================================
// Staff — editar/eliminar item de prepedido de OTRO comensal (REST autenticado)
// El backend (0006, SECURITY DEFINER) valida que la mesa del item sea del negocio.
// ============================================================

export interface EditarItemPrepedidoStaffInput {
  idItem: string;
  cantidad: number;
  tieneAlergia?: boolean;
  nota?: string | null;
  extras: Array<{ id_insumo_extra: string }>;
  exclusiones: Array<{ id_insumo: string }>;
  variantes: Array<{ id_opcion: string }>;
}

export function editarItemPrepedidoStaff(
  input: EditarItemPrepedidoStaffInput,
): Promise<{ ok: true }> {
  const { idItem, ...body } = input;
  return api.patch<{ ok: true }>(`/prepedido/items/${idItem}`, body);
}

export function eliminarItemPrepedidoStaff(input: { idItem: string }): Promise<{ ok: true }> {
  return api.post<{ ok: true }>(`/prepedido/items/${input.idItem}/eliminar`);
}
