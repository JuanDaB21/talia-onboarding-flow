// Carta pública (comensal por QR) vía REST del backend Talia (/carta/*).
// Endpoints públicos (sin auth): el backend deriva el negocio desde la mesa con
// funciones SECURITY DEFINER.
import { api } from "@/lib/api-client";

export interface CartaProducto {
  id_producto: string;
  nombre_producto: string;
  descripcion_producto: string | null;
  precio_venta: number;
  url_imagen: string | null;
  id_categoria: string;
  nombre_categoria: string;
}

export interface CartaCategoria {
  id_categoria: string;
  nombre: string;
  /** Foto del tile de portada (0060); null → la carta usa la del primer producto. */
  url_imagen?: string | null;
}

export type TipoFondoMenu = "NINGUNO" | "IMAGEN" | "VIDEO";

/** Fondo multimedia detrás de la carta (0060). `oscurecer` = % de velo del color del tema. */
export interface CartaFondo {
  tipo: TipoFondoMenu;
  url: string | null;
  poster: string | null;
  oscurecer: number;
}

export interface CartaMesa {
  id_mesa: string;
  identificador: string;
  estado: string;
  solicitud_cliente: string | null;
  solicitud_at: string | null;
}

export interface CartaNegocio {
  nombre_comercial: string;
  url_logo: string | null;
  tema_menu: string;
  fondo?: CartaFondo | null;
  // Solo en el menú del negocio (0059): contacto y pedidos en línea.
  whatsapp_numero?: string | null;
  instagram_url?: string | null;
  direccion?: string | null;
  domicilios_activo?: boolean;
  recoger_activo?: boolean;
  tiempo_estimado_min?: number | null;
  pedido_minimo?: number | string;
}

export interface CartaMunicipio {
  id_municipio: string;
  nombre: string;
  costo_envio: number;
}

export interface CartaMetodoPago {
  id: string;
  nombre: string;
  titular: string | null;
  datos_cuenta: string | null;
  tiene_qr: boolean;
}

interface CartaState {
  mesa: CartaMesa;
  negocio: CartaNegocio;
  categorias: CartaCategoria[];
  productos: CartaProducto[];
  estado: { tiene_pedido_activo: boolean };
}

export interface MenuPublico {
  mesa: CartaMesa;
  negocio: CartaNegocio;
  categorias: CartaCategoria[];
  productos: CartaProducto[];
}

export async function getMenuPublico(idMesa: string): Promise<MenuPublico> {
  const s = await api.get<CartaState>(`/carta/${idMesa}/state`);
  return { mesa: s.mesa, negocio: s.negocio, categorias: s.categorias, productos: s.productos };
}

// Menú público del NEGOCIO (sin mesa): carta para compartir en redes/WhatsApp y, si el
// negocio lo activa, pedidos a domicilio / para recoger (0059).
export interface MenuNegocioPublico {
  negocio: CartaNegocio;
  categorias: CartaCategoria[];
  productos: CartaProducto[];
  municipios: CartaMunicipio[];
  metodos_pago: CartaMetodoPago[];
}

export async function getMenuPublicoNegocio(idNegocio: string): Promise<MenuNegocioPublico> {
  const m = await api.get<MenuNegocioPublico>(`/carta/negocio/${idNegocio}/menu`);
  return {
    ...m,
    productos: (m.productos ?? []).map((p) => ({ ...p, precio_venta: Number(p.precio_venta) })),
    municipios: (m.municipios ?? []).map((x) => ({ ...x, costo_envio: Number(x.costo_envio) })),
    metodos_pago: m.metodos_pago ?? [],
  };
}

export function llamarMesero(idMesa: string): Promise<{ ok: true }> {
  return api.post<{ ok: true }>(`/carta/${idMesa}/llamar-mesero`);
}

export interface EstadoMesaPublico {
  id_mesa: string;
  identificador: string;
  estado: string;
  solicitud_cliente: string | null;
  tiene_pedido_activo: boolean;
}

export async function getEstadoMesaPublico(idMesa: string): Promise<EstadoMesaPublico> {
  const s = await api.get<CartaState>(`/carta/${idMesa}/state`);
  return {
    id_mesa: s.mesa.id_mesa,
    identificador: s.mesa.identificador,
    estado: s.mesa.estado,
    solicitud_cliente: s.mesa.solicitud_cliente ?? null,
    tiene_pedido_activo: s.estado?.tiene_pedido_activo ?? false,
  };
}

export function solicitarAccionCliente(input: {
  idMesa: string;
  tipo: "PEDIR_MAS" | "CUENTA" | "TOMAR_PEDIDO";
}): Promise<{ ok: true }> {
  return api.post<{ ok: true }>(`/carta/${input.idMesa}/solicitar`, { tipo: input.tipo });
}

export interface CuentaItem {
  id_item: string;
  nombre_producto: string;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
  extras: Array<{ nombre: string; precio: number }>;
  exclusiones: Array<{ nombre: string }>;
  variantes: Array<{ nombre_grupo: string; nombre_opcion: string; precio_delta: number }>;
  nota: string | null;
}

export interface CuentaPublica {
  identificador_mesa: string;
  nombre_negocio: string;
  url_logo: string | null;
  items: CuentaItem[];
  total: number;
  fecha: string;
}

export async function getCuentaPublica(idMesa: string): Promise<CuentaPublica> {
  const c = await api.get<Omit<CuentaPublica, "fecha">>(`/carta/${idMesa}/cuenta`);
  return { ...c, fecha: new Date().toISOString() };
}
