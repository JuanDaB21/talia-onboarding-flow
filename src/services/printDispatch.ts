import { useEffect, useState } from "react";
import { listarEspacios } from "@/lib/espacios.functions";
import { getImpresionConfigs } from "@/lib/impresion.functions";
import { getNegocioConfig } from "@/lib/negocio.functions";
import { imprimirComandas, type ComandaPrintData } from "@/components/preparacion/comanda-print";
import {
  isWebUSBSupported,
  getPairedPrinter,
  printComandaOnPairedPrinter,
  describePrinterError,
} from "@/services/usbPrinter";
import {
  getPrinterAlerts,
  pushPrinterAlert,
  subscribePrinterAlerts,
  type PrinterAlert,
} from "@/services/printerAlerts";

interface EspacioBasico {
  slug: string;
  nombre: string;
  ancho_papel_mm?: number;
}

async function loadEspaciosMap(): Promise<Map<string, EspacioBasico>> {
  const [espacios, cfg] = await Promise.all([listarEspacios(), getImpresionConfigs()]);
  const map = new Map<string, EspacioBasico>();
  const anchoPorEspacio = new Map<string, number>();
  for (const c of cfg) {
    anchoPorEspacio.set(c.id_espacio, c.ancho_papel_mm);
  }
  for (const e of espacios) {
    map.set(e.slug.toUpperCase(), {
      slug: e.slug.toUpperCase(),
      nombre: e.nombre,
      ancho_papel_mm: anchoPorEspacio.get(e.id_espacio) ?? 80,
    });
  }
  return map;
}

async function loadNegocio(): Promise<string> {
  try {
    const n = await getNegocioConfig();
    return n.nombre_comercial ?? "";
  } catch {
    return "";
  }
}

/**
 * Intenta imprimir cada comanda por USB. Las que no tengan impresora vinculada
 * o WebUSB no soportado caen a la ventana del navegador. Las que fallen por
 * desconexión se registran como alertas en Operación en vivo.
 */
export async function dispatchComandas(comandas: ComandaPrintData[]): Promise<void> {
  if (comandas.length === 0) return;

  const [espMap, negocio] = await Promise.all([loadEspaciosMap(), loadNegocio()]);

  const fallback: ComandaPrintData[] = [];

  await Promise.all(
    comandas.map(async (c) => {
      const slug = c.destino.toUpperCase();
      const meta = espMap.get(slug);
      const paired = isWebUSBSupported() ? getPairedPrinter(slug) : null;

      if (!paired) {
        fallback.push(c);
        return;
      }
      const outcome = await printComandaOnPairedPrinter(c, {
        negocio,
        anchoMm: meta?.ancho_papel_mm ?? 80,
      });
      if (!outcome.ok) {
        pushPrinterAlert({
          slug,
          espacio_nombre: meta?.nombre ?? slug,
          motivo: mapMotivo(outcome.error),
          comanda: c,
        });
        fallback.push(c);
      }
    }),
  );

  if (fallback.length > 0) {
    // Abre la ventana del navegador con las que no se pudieron imprimir por USB.
    void imprimirComandas(fallback);
  }
}

function mapMotivo(err: string | undefined): string {
  return describePrinterError(err);
}

// -------- Hook para Operación en vivo -------- //

export function usePrinterAlerts(): PrinterAlert[] {
  const [alerts, setAlerts] = useState<PrinterAlert[]>(() => getPrinterAlerts());
  useEffect(() => subscribePrinterAlerts(setAlerts), []);
  return alerts;
}
