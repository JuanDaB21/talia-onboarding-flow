// Gestión de bodegas vía REST del backend Talia (/bodega/*).
import { api } from "@/lib/api-client";

export interface Bodega {
  id_bodega: string;
  nombre: string;
  activa: boolean;
  orden: number;
  espacios_principales: { id_espacio: string; nombre: string; slug: string }[];
}

export interface InventarioPorBodegaRow {
  id_insumo: string;
  id_bodega: string;
  cantidad_actual: number;
}

export function listarBodegas() {
  return api.get<Bodega[]>("/bodega/bodegas");
}

export function crearBodega(input: { nombre: string }) {
  return api.post<Bodega>("/bodega/bodegas", { nombre: input.nombre });
}

export function renombrarBodega(input: { id_bodega: string; nombre: string }) {
  return api.patch<{ ok: true }>(`/bodega/bodegas/${input.id_bodega}`, { nombre: input.nombre });
}

export function toggleBodega(input: { id_bodega: string; activa: boolean }) {
  return api.patch<{ ok: true }>(`/bodega/bodegas/${input.id_bodega}`, { activa: input.activa });
}

export function eliminarBodega(input: { id_bodega: string }) {
  return api.post<{ ok: true }>(`/bodega/bodegas/${input.id_bodega}/eliminar`);
}

export function setBodegaPrincipalEspacio(input: { id_espacio: string; id_bodega: string }) {
  return api.post<{ ok: true }>(`/bodega/espacios/${input.id_espacio}/bodega-principal`, {
    idBodega: input.id_bodega,
  });
}

export function trasladarInventario(input: {
  id_insumo: string;
  id_bodega_origen: string;
  id_bodega_destino: string;
  cantidad: number;
  motivo: string;
}) {
  return api.post<{ ok: true }>("/bodega/trasladar", {
    idInsumo: input.id_insumo,
    idBodegaOrigen: input.id_bodega_origen,
    idBodegaDestino: input.id_bodega_destino,
    cantidad: input.cantidad,
    motivo: input.motivo,
  });
}
