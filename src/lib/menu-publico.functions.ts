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
}

export interface CartaMesa {
  id_mesa: string;
  identificador: string;
  estado: string;
}

export interface CartaNegocio {
  nombre_comercial: string;
  url_logo: string | null;
  tema_menu: string;
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

export function llamarMesero(idMesa: string): Promise<{ ok: true }> {
  return api.post<{ ok: true }>(`/carta/${idMesa}/llamar-mesero`);
}

export interface EstadoMesaPublico {
  id_mesa: string;
  identificador: string;
  estado: string;
  tiene_pedido_activo: boolean;
}

export async function getEstadoMesaPublico(idMesa: string): Promise<EstadoMesaPublico> {
  const s = await api.get<CartaState>(`/carta/${idMesa}/state`);
  return {
    id_mesa: s.mesa.id_mesa,
    identificador: s.mesa.identificador,
    estado: s.mesa.estado,
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
