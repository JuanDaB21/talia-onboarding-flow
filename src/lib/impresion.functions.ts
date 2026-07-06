// Config de impresión por espacio vía REST del backend Talia (/impresion).
import { api } from "@/lib/api-client";

export interface ImpresionConfig {
  id_espacio: string;
  requiere_impresora: boolean;
  ancho_papel_mm: number;
  codepage: string;
}

export function getImpresionConfigs() {
  return api.get<ImpresionConfig[]>("/impresion");
}

export function guardarImpresionAncho(input: { id_espacio: string; ancho_papel_mm: 58 | 80 }) {
  return api.post<{ ok: true }>("/impresion", {
    id_espacio: input.id_espacio,
    ancho_papel_mm: input.ancho_papel_mm,
  });
}
