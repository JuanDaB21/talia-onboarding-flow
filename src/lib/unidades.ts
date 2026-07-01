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
 * Unidades válidas para receta dada una unidad de compra.
 * Se permite cualquier unidad: misma familia (conversión automática) o
 * cualquier otra (factor manual aproximado, ej. 1 caja ≈ 500 g, 1 lb ≈ 2 unidades).
 */
export function unidadesPermitidasParaReceta(unidadCompra?: string | null): Unidad[] {
  const uc = getUnidad(unidadCompra);
  if (!uc) return [];
  const misma = unidadesDeFamilia(uc.familia);
  const otras = UNIDADES.filter((u) => u.familia !== uc.familia);
  return [...misma, ...otras];
}

/**
 * ¿La combinación compra/receta es válida? Cualquier combinación lo es.
 */
export function combinacionPermitida(
  unidadCompra?: string | null,
  unidadReceta?: string | null,
): boolean {
  return !!getUnidad(unidadCompra) && !!getUnidad(unidadReceta);
}

/**
 * ¿El usuario debe ingresar el factor manualmente?
 * - Unidad de compra con manualFactor (Caja, Paquete, Bandeja, Docena).
 * - Compra y receta de distinta familia (cualquier cruce aproximado).
 */
export function requiereFactorManual(
  unidadCompra?: string | null,
  unidadReceta?: string | null,
): boolean {
  const uc = getUnidad(unidadCompra);
  if (!uc) return false;
  if (uc.manualFactor) return true;
  const ur = getUnidad(unidadReceta);
  if (ur && uc.familia !== ur.familia) return true;
  return false;
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

// Etiquetas cortas para presentación
const SHORT_LABEL: Record<string, string> = {
  Kilogramo: "kg",
  Libra: "lb",
  Onza: "oz",
  Gramo: "g",
  Galon: "gal",
  Litro: "L",
  OnzaLiquida: "fl oz",
  Mililitro: "ml",
  Unidad: "u",
  Caja: "caja",
  Paquete: "paquete",
  Bandeja: "bandeja",
  Docena: "docena",
};

function shortLabel(code?: string | null): string {
  if (!code) return "";
  return SHORT_LABEL[code] ?? code.toLowerCase();
}

function pluralizar(code: string, n: number): string {
  const base = shortLabel(code);
  if (n === 1) return base;
  // pluralización simple ES
  if (base.endsWith("s")) return base;
  if (base === "u") return "u";
  return base + "s";
}

function trimNum(n: number, decimals = 2): string {
  const rounded = Math.round(n * 10 ** decimals) / 10 ** decimals;
  return rounded.toLocaleString(undefined, { maximumFractionDigits: decimals });
}

/**
 * Formato inteligente para mostrar una cantidad almacenada en `unidadReceta`.
 * - PESO/VOLUMEN: combina la unidad mayor (compra si aplica, sino kg/L) con la menor.
 *   Ej: 19750 g -> "19 kg 750 g", 750 g -> "750 g", 3250 ml -> "3 L 250 ml"
 * - UNIDAD con factor > 1 (Caja/Paquete/Bandeja/Docena): "2 cajas y 18 unidades"
 * - UNIDAD simple: "18 unidades"
 */
export function formatStockInteligente(
  cantidad: number,
  unidadReceta?: string | null,
  unidadCompra?: string | null,
  factorConversion?: number | null,
): string {
  const n = Number(cantidad);
  if (!isFinite(n)) return "0";
  const ur = getUnidad(unidadReceta);
  if (!ur) return n.toLocaleString();

  const signo = n < 0 ? "-" : "";
  const abs = Math.abs(n);

  if (ur.familia === "PESO" || ur.familia === "VOLUMEN") {
    // unidad menor = unidad de receta
    // unidad mayor: usa la unidad de compra si pertenece a la misma familia y es mayor, sino kg/L
    const uc = getUnidad(unidadCompra);
    let mayor = uc && uc.familia === ur.familia && uc.base > ur.base ? uc : null;
    if (!mayor) {
      mayor = ur.familia === "PESO" ? getUnidad("Kilogramo")! : getUnidad("Litro")!;
    }
    const factor = mayor.base / ur.base; // cuántas unidades de receta en 1 mayor
    if (abs < factor) {
      return `${signo}${trimNum(abs, 2)} ${shortLabel(ur.code)}`;
    }
    const enteras = Math.floor(abs / factor);
    const resto = abs - enteras * factor;
    if (resto === 0) {
      return `${signo}${enteras.toLocaleString()} ${shortLabel(mayor.code)}`;
    }
    return `${signo}${enteras.toLocaleString()} ${shortLabel(mayor.code)} ${trimNum(resto, 2)} ${shortLabel(ur.code)}`;
  }

  // UNIDAD
  const factor = Number(factorConversion ?? 1);
  const uc = getUnidad(unidadCompra);
  const usaCompra = uc && uc.familia === "UNIDAD" && uc.manualFactor && factor > 1;

  if (usaCompra) {
    const enteras = Math.floor(abs / factor);
    const sueltas = abs - enteras * factor;
    const sueltasLabel = trimNum(sueltas, 2);
    const sueltasPlural = sueltas === 1 ? 1 : 2;
    if (enteras === 0) {
      return `${signo}${sueltasLabel} ${pluralizar("Unidad", sueltasPlural)}`;
    }
    if (sueltas === 0) {
      return `${signo}${enteras.toLocaleString()} ${pluralizar(uc!.code, enteras)}`;
    }
    return `${signo}${enteras.toLocaleString()} ${pluralizar(uc!.code, enteras)} y ${sueltasLabel} ${pluralizar("Unidad", sueltasPlural)}`;
  }

  const plural = abs === 1 ? 1 : 2;
  return `${signo}${trimNum(abs, 2)} ${pluralizar("Unidad", plural)}`;
}
