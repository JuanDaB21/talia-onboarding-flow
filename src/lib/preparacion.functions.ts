// Cocina/barra (comandas por estación) vía REST del backend Talia (/preparacion/*).
import { api } from "@/lib/api-client";

export interface ItemPreparacion {
  id_item: string;
  id_pedido: string;
  id_producto: string;
  nombre_producto: string;
  nombre_subcategoria: string | null;
  cantidad: number;
  tiene_alergia: boolean;
  nota: string | null;
  destino: string;
  estado_preparacion: string;
  tiempo_planeado_min: number | null;
  iniciado_at: string | null;
  listo_at: string | null;
  entregado_at: string | null;
  pedido_created_at: string;
  mesa_identificador: string;
  extras: { nombre: string; cantidad: number }[];
  exclusiones: { nombre: string }[];
  variantes: { nombre_grupo: string; nombre_opcion: string }[];
}

export interface ComandaEstacion {
  id_pedido: string;
  mesa_identificador: string;
  pedido_created_at: string;
  mesero_nombre: string | null;
  items: ItemPreparacion[];
}

export function listarComandasEstacion(destino: string) {
  return api.post<{ comandas: ComandaEstacion[] }>("/preparacion/comandas", { destino });
}

// La preparación arranca sola al confirmar el pedido (se imprime la comanda),
// así que la estación solo marca LISTO. Ya no existe el paso "iniciar".
export function avanzarItem(input: { idItem: string; nuevoEstado: "LISTO" }) {
  return api.post<{ ok: true }>(`/preparacion/items/${input.idItem}/avanzar`, {
    nuevoEstado: input.nuevoEstado,
  });
}
