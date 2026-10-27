// Domicilios desde la carta pública (cliente sin login) vía REST del backend Talia
// (/domicilios/public/*). El backend recalcula precios y deriva el negocio del
// idNegocio o del token del pedido (funciones SECURITY DEFINER, 0059).
import { api, fetchYLeer } from "@/lib/api-client";
import { compressForScope } from "@/lib/image-compress";

export type TipoEntrega = "DOMICILIO" | "RECOGER";
export type MetodoPagoDomicilio = "EFECTIVO" | "TRANSFERENCIA" | "EN_LOCAL";
export type EstadoDomicilio =
  "PENDIENTE" | "EN_PREPARACION" | "LISTO" | "EN_CAMINO" | "ENTREGADO" | "CANCELADO";

export interface ItemPedidoDomicilio {
  id_producto: string;
  cantidad: number;
  nota?: string | null;
  tiene_alergia?: boolean;
  extras: Array<{ id_insumo_extra: string }>;
  exclusiones: Array<{ id_insumo: string }>;
  variantes: Array<{ id_opcion: string }>;
}

export interface CrearPedidoDomicilioInput {
  idNegocio: string;
  tipo: TipoEntrega;
  cliente_nombre: string;
  cliente_telefono: string;
  direccion?: string | null;
  referencia?: string | null;
  id_municipio?: string | null;
  metodo_pago: MetodoPagoDomicilio;
  paga_con?: number | null;
  id_metodo_pago?: string | null;
  notas?: string | null;
  idempotency_key: string;
  items: ItemPedidoDomicilio[];
}

export function crearPedidoDomicilio(input: CrearPedidoDomicilioInput) {
  return api.post<{ token: string; codigo: string }>("/domicilios/public", input);
}

export interface SeguimientoDomicilio {
  codigo: string;
  tipo: TipoEntrega;
  estado: EstadoDomicilio;
  motivo_cancelacion: string | null;
  cliente_nombre: string;
  direccion: string | null;
  municipio: string | null;
  metodo_pago: MetodoPagoDomicilio;
  paga_con: number | null;
  comprobante_subido: boolean;
  pagado: boolean;
  subtotal: number;
  costo_envio: number;
  total: number;
  items: Array<{ nombre: string; cantidad: number; subtotal: number; detalle: string }>;
  created_at: string;
  confirmado_at: string | null;
  listo_at: string | null;
  en_camino_at: string | null;
  entregado_at: string | null;
  cancelado_at: string | null;
  negocio: {
    id_negocio: string;
    nombre_comercial: string;
    url_logo: string | null;
    tema_menu: string;
    whatsapp_numero: string | null;
    instagram_url: string | null;
    tiempo_estimado_min: number | null;
  };
}

// pg serializa numeric como string: se coacciona aquí para que la vista sume números.
export async function getSeguimientoDomicilio(token: string): Promise<SeguimientoDomicilio> {
  const s = await api.get<SeguimientoDomicilio>(`/domicilios/public/${token}`);
  return {
    ...s,
    subtotal: Number(s.subtotal ?? 0),
    costo_envio: Number(s.costo_envio ?? 0),
    total: Number(s.total ?? 0),
    paga_con: s.paga_con == null ? null : Number(s.paga_con),
    items: (s.items ?? []).map((i) => ({ ...i, subtotal: Number(i.subtotal) })),
  };
}

const UPLOAD_TIMEOUT_MS = 30_000;

/** Sube el comprobante de transferencia del pedido (imagen comprimida en el navegador o PDF). */
export async function subirComprobanteDomicilio(token: string, file: File): Promise<void> {
  const toUpload = await compressForScope("comprobante", file);
  const contentType = (toUpload as File).type || file.type || "application/octet-stream";
  await fetchYLeer(
    `${api.url}/domicilios/public/${token}/comprobante`,
    { method: "POST", headers: { "content-type": contentType }, body: toUpload },
    UPLOAD_TIMEOUT_MS,
    async (res) => {
      if (!res.ok) {
        let msg = "No se pudo subir el comprobante";
        try {
          const j = (await res.json()) as { error?: { message?: string } };
          if (j.error?.message) msg = j.error.message;
        } catch {
          /* respuesta no-JSON */
        }
        throw new Error(msg);
      }
    },
  );
}

export interface OpcionesProductoCarta {
  extras: Array<{ id_insumo_extra: string; precio_extra: number; nombre_insumo: string }>;
  ingredientes: Array<{ id_insumo: string; nombre_insumo: string }>;
  variantes: Array<{
    id_grupo: string;
    nombre: string;
    seleccion: string;
    opciones: Array<{ id_opcion: string; nombre_opcion: string; precio_delta: number }>;
  }>;
  permite_quitar_ingredientes: boolean;
}

export async function getOpcionesProductoCarta(
  idNegocio: string,
  idProducto: string,
): Promise<OpcionesProductoCarta> {
  const o = await api.get<OpcionesProductoCarta>(
    `/domicilios/public/negocio/${idNegocio}/productos/${idProducto}/opciones`,
  );
  return {
    extras: (o.extras ?? []).map((e) => ({ ...e, precio_extra: Number(e.precio_extra ?? 0) })),
    ingredientes: o.ingredientes ?? [],
    variantes: (o.variantes ?? []).map((g) => ({
      ...g,
      opciones: (g.opciones ?? []).map((op) => ({
        ...op,
        precio_delta: Number(op.precio_delta ?? 0),
      })),
    })),
    permite_quitar_ingredientes: o.permite_quitar_ingredientes !== false,
  };
}

/** URL absoluta del QR público de un método de pago (para <img src>). */
export function qrMetodoPagoUrl(idNegocio: string, idMetodo: string): string {
  return `${api.url}/domicilios/public/negocio/${idNegocio}/metodos/${idMetodo}/qr`;
}
