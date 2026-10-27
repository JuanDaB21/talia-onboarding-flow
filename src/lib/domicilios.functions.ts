// Módulo Domicilios (staff: ADMIN/CAJERO) vía REST del backend Talia (/domicilios/*).
// Los pedidos llegan desde la carta pública como PENDIENTE; caja los confirma (→ cocina),
// los despacha y los cobra. La lógica vive en Postgres (0059).
import { api } from "@/lib/api-client";
import type {
  EstadoDomicilio,
  MetodoPagoDomicilio,
  TipoEntrega,
} from "@/lib/domicilios-publico.functions";

export type { EstadoDomicilio, MetodoPagoDomicilio, TipoEntrega };

export interface ItemDomicilio {
  id_item: string;
  id_producto: string | null;
  nombre_producto: string;
  cantidad: number;
  precio_unitario: number;
  extras_total: number;
  nota: string | null;
  tiene_alergia: boolean;
  destino: string | null;
  estado_preparacion: string;
  pagado: boolean;
  extras: Array<{ nombre: string; cantidad: number }>;
  exclusiones: Array<{ nombre: string }>;
  variantes: Array<{ nombre_grupo: string; nombre_opcion: string }>;
}

export interface Domicilio {
  id_domicilio: string;
  id_pedido: string;
  codigo: string;
  tipo: TipoEntrega;
  estado: EstadoDomicilio;
  cliente_nombre: string;
  cliente_telefono: string;
  direccion: string | null;
  referencia: string | null;
  municipio_nombre: string | null;
  costo_envio: number;
  metodo_pago: MetodoPagoDomicilio;
  paga_con: number | null;
  id_metodo_pago: string | null;
  metodo_pago_nombre: string | null;
  url_comprobante: string | null;
  notas: string | null;
  motivo_cancelacion: string | null;
  created_at: string;
  confirmado_at: string | null;
  listo_at: string | null;
  en_camino_at: string | null;
  entregado_at: string | null;
  cancelado_at: string | null;
  updated_at: string;
  subtotal: number;
  total: number;
  pagado: boolean;
  id_pago_pendiente: string | null;
  items: ItemDomicilio[];
}

function normalizar(d: Domicilio): Domicilio {
  return {
    ...d,
    items: (d.items ?? []).map((i) => ({
      ...i,
      cantidad: Number(i.cantidad),
      precio_unitario: Number(i.precio_unitario),
      extras_total: Number(i.extras_total ?? 0),
    })),
  };
}

export async function listarDomicilios(): Promise<Domicilio[]> {
  const r = await api.get<{ domicilios: Domicilio[] }>("/domicilios");
  return (r.domicilios ?? []).map(normalizar);
}

export async function getDomicilio(idDomicilio: string): Promise<Domicilio> {
  return normalizar(await api.get<Domicilio>(`/domicilios/${idDomicilio}`));
}

export function confirmarDomicilio(idDomicilio: string) {
  return api.post<{ idPedido: string }>(`/domicilios/${idDomicilio}/confirmar`);
}

export function avanzarDomicilio(input: {
  idDomicilio: string;
  estado: "EN_CAMINO" | "ENTREGADO";
}) {
  return api.post<{ estado: string }>(`/domicilios/${input.idDomicilio}/avanzar`, {
    estado: input.estado,
  });
}

export function cancelarDomicilio(input: {
  idDomicilio: string;
  motivo?: string;
  reponer: boolean;
}) {
  return api.post<{ ok: true }>(`/domicilios/${input.idDomicilio}/cancelar`, {
    motivo: input.motivo ?? null,
    reponer: input.reponer,
  });
}

export function cobrarDomicilio(input: {
  idDomicilio: string;
  metodo: "EFECTIVO" | "TRANSFERENCIA" | "DATAFONO";
  subtipo?: string | null;
  voucher?: string | null;
  urlComprobante?: string | null;
  propina?: number;
  idBono?: string | null;
  aprobarTransferencia?: boolean;
  montoRecibido?: number | null;
}) {
  const { idDomicilio, ...body } = input;
  return api.post<{ idPago: string }>(`/domicilios/${idDomicilio}/cobrar`, body);
}

// ── Municipios (tarifas de envío) ──────────────────────────────────────────
export interface MunicipioEnvio {
  id_municipio: string;
  nombre: string;
  costo_envio: number;
  activo: boolean;
  orden: number;
}

export async function listarMunicipios(): Promise<MunicipioEnvio[]> {
  const rows = await api.get<MunicipioEnvio[]>("/domicilios/config/municipios");
  return rows.map((m) => ({ ...m, costo_envio: Number(m.costo_envio) }));
}

export function guardarMunicipio(input: {
  idMunicipio?: string;
  nombre: string;
  costoEnvio: number;
  activo: boolean;
  orden?: number;
}) {
  return api.post<{ idMunicipio: string }>("/domicilios/config/municipios", input);
}

export function eliminarMunicipio(idMunicipio: string) {
  return api.del<{ ok: true }>(`/domicilios/config/municipios/${idMunicipio}`);
}
