// Bonos y descuentos vía REST del backend Talia (/bonos/*).
import { api } from "@/lib/api-client";

export type TipoBono = "PORCENTAJE" | "VALOR";

export interface Bono {
  id_bono: string;
  nombre: string;
  tipo: TipoBono;
  porcentaje: number | null;
  valor: number;
  activo: boolean;
  created_at: string;
}

export interface BonoAplicacion {
  id_aplicacion: string;
  id_bono: string | null;
  id_pago: string;
  id_mesa: string | null;
  id_mesero: string | null;
  mesero_nombre: string | null;
  identificador_mesa: string | null;
  nombre_bono: string;
  porcentaje_aplicado: number;
  subtotal_items: number;
  monto_descuento: number;
  monto_descuento_neto: number;
  created_at: string;
}

export function listarBonos() {
  return api.get<{ esAdmin: boolean; bonos: Bono[] }>("/bonos");
}

export function crearBono(input: {
  nombre: string;
  tipo: TipoBono;
  porcentaje?: number | null;
  valor?: number | null;
}) {
  return api.post<{ idBono: string }>("/bonos", input);
}

export function actualizarBono(input: {
  idBono: string;
  nombre: string;
  tipo: TipoBono;
  porcentaje?: number | null;
  valor?: number | null;
  activo: boolean;
}) {
  const { idBono, ...body } = input;
  return api.patch<{ ok: true }>(`/bonos/${idBono}`, body);
}

export function eliminarBono(input: { idBono: string }) {
  return api.del<{ ok: true }>(`/bonos/${input.idBono}`);
}

export function previsualizarBono(input: { idBono: string; itemIds: string[] }) {
  return api.post<{
    nombre: string;
    tipo: TipoBono;
    porcentaje: number;
    valor: number;
    descuento: number;
    descuento_neto: number;
    subtotal: number;
  }>("/bonos/previsualizar", input);
}

export function historialBonos(input?: {
  desde?: string | null;
  hasta?: string | null;
  idMesero?: string | null;
}) {
  const qs = new URLSearchParams();
  if (input?.desde) qs.set("desde", input.desde);
  if (input?.hasta) qs.set("hasta", input.hasta);
  if (input?.idMesero) qs.set("idMesero", input.idMesero);
  const suffix = qs.toString() ? `?${qs}` : "";
  return api.get<{
    aplicaciones: BonoAplicacion[];
    total_regalado: number;
    total_neto: number;
    total_aplicaciones: number;
    meseros: { id: string; nombre: string }[];
    esAdmin: boolean;
  }>(`/bonos/historial${suffix}`);
}
