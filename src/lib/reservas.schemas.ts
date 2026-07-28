import { z } from "zod";

export const ESTADOS_RESERVA = [
  "intencion",
  "abonado",
  "cancelada_devuelto",
  "cancelada_retenido",
  "asistida",
] as const;

export type EstadoReserva = (typeof ESTADOS_RESERVA)[number];

export const ESTADO_LABEL: Record<EstadoReserva, string> = {
  intencion: "Intención",
  abonado: "Abonado",
  cancelada_devuelto: "Cancelada (devuelto)",
  cancelada_retenido: "Cancelada (retenido)",
  asistida: "Asistida",
};

export const reservaBaseSchema = z.object({
  customer_name: z.string().trim().min(1, "Nombre requerido").max(100),
  customer_phone: z.string().trim().max(30).optional().nullable(),
  fecha_reserva: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida"),
  hora_reserva: z.string().trim().min(1, "Hora requerida").max(20),
  cantidad_personas: z.number().int().min(1).max(500),
  tipo_reserva: z.string().trim().max(50).optional().nullable(),
  estado: z.enum(ESTADOS_RESERVA).default("intencion"),
  monto_abonado: z.number().min(0).max(100_000_000).default(0),
  id_metodo_pago_qr: z.string().uuid().optional().nullable(),
});

export const reservaCrearSchema = reservaBaseSchema
  .refine((v) => v.estado !== "abonado" || v.monto_abonado > 0, {
    message: "Si el estado es 'Abonado', el monto debe ser mayor a 0",
    path: ["monto_abonado"],
  })
  // La recíproca: sin esto se guardaba un abono con estado 'intencion' y la
  // reserva nunca aparecía en el checkout, porque `aplicables-hoy` filtra por
  // estado IN ('abonado','asistida').
  .refine((v) => v.monto_abonado <= 0 || v.estado !== "intencion", {
    message: "Con abono registrado el estado no puede ser 'Intención'",
    path: ["estado"],
  });
// Nota: `id_metodo_pago_qr` es opcional a propósito. Antes se exigía cuando había
// abono, pero un negocio que recibe el abono en EFECTIVO no tiene cuenta QR que
// seleccionar y el formulario quedaba bloqueado. NULL = efectivo/otro.

export type ReservaCrearInput = z.input<typeof reservaCrearSchema>;

/** Etiqueta del medio del abono cuando no se registró contra una cuenta QR. */
export const MEDIO_ABONO_EFECTIVO = "Efectivo / otro";
