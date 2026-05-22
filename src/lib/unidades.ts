// Catálogo de unidades para Insumos. Vive en el cliente.
// Cada unidad pertenece a una familia y tiene un "valor base" en la unidad base de su familia.

export type Familia = "PESO" | "VOLUMEN" | "UNIDAD";

export interface Unidad {
  code: string;        // valor almacenado en DB (unidad_compra / unidad_receta)
  label: string;       // etiqueta visible
  familia: Familia;
  base: number;        // valor en unidad base de la familia
  manualFactor?: boolean; // true => requiere que el usuario ingrese el factor
  defaultFactor?: number; // sugerencia inicial (Docena = 12, etc.)
}

// Bases por familia: Gramo (PESO), Mililitro (VOLUMEN), Unidad (UNIDAD)
export const UNIDADES: Unidad[] = [
  // PESO (base: gramo)
  { code: "Kilogramo", label: "Kilogramo (kg)", familia: "PESO", base: 1000 },
  { code: "Libra", label: "Libra (lb)", familia: "PESO", base: 453.592 },
  { code: "Onza", label: "Onza (oz)", familia: "PESO", base: 28.3495 },
  { code: "Gramo", label: "Gramo (g)", familia: "PESO", base: 1 },

  // VOLUMEN (base: mililitro)
  { code: "Galon", label: "Galón (gal)", familia: "VOLUMEN", base: 3785.41 },
  { code: "Litro", label: "Litro (L)", familia: "VOLUMEN", base: 1000 },
  { code: "OnzaLiquida", label: "Onza líquida (fl oz)", familia: "VOLUMEN", base: 29.5735 },
  { code: "Mililitro", label: "Mililitro (ml)", familia: "VOLUMEN", base: 1 },

  // UNIDAD (base: unidad)
  { code: "Caja", label: "Caja", familia: "UNIDAD", base: 1, manualFactor: true },
  { code: "Paquete", label: "Paquete", familia: "UNIDAD", base: 1, manualFactor: true },
  { code: "Bandeja", label: "Bandeja", familia: "UNIDAD", base: 1, manualFactor: true },
  { code: "Docena", label: "Docena", familia: "UNIDAD", base: 1, manualFactor: true, defaultFactor: 12 },
  { code: "Unidad", label: "Unidad", familia: "UNIDAD", base: 1 },
];

export const UNIDAD_CODES = UNIDADES.map((u) => u.code) as [string, ...string[]];

export function getUnidad(code: string | undefined | null): Unidad | undefined {
  if (!code) return undefined;
  return UNIDADES.find((u) => u.code === code);
}

export function getFamilia(code: string | undefined | null): Familia | undefined {
  return getUnidad(code)?.familia;
}

export function unidadesDeFamilia(familia: Familia): Unidad[] {
  return UNIDADES.filter((u) => u.familia === familia);
}

export function unidadBaseDeFamilia(familia: Familia): Unidad {
  if (familia === "PESO") return getUnidad("Gramo")!;
  if (familia === "VOLUMEN") return getUnidad("Mililitro")!;
  return getUnidad("Unidad")!;
}

/**
 * ¿El usuario debe ingresar el factor manualmente?
 * Solo cuando la unidad de compra es UNIDAD y no es "Unidad" (ej. Caja, Paquete, Bandeja, Docena).
 */
export function requiereFactorManual(unidadCompra?: string | null): boolean {
  const u = getUnidad(unidadCompra);
  return Boolean(u?.manualFactor);
}

/**
 * Calcula el factor automáticamente para PESO/VOLUMEN y para UNIDAD-Unidad.
 * Devuelve null si las unidades no son compatibles o si requiere entrada manual.
 */
export function calcularFactor(
  unidadCompra?: string | null,
  unidadReceta?: string | null
): number | null {
  const uc = getUnidad(unidadCompra);
  const ur = getUnidad(unidadReceta);
  if (!uc || !ur) return null;
  if (uc.familia !== ur.familia) return null;
  if (uc.manualFactor) return null;
  return uc.base / ur.base;
}

export function formatFactor(n: number): string {
  // Hasta 4 decimales sin ceros sobrantes
  const rounded = Math.round(n * 10000) / 10000;
  return rounded.toString();
}

export function labelDe(code?: string | null): string {
  return getUnidad(code)?.label ?? code ?? "";
}
