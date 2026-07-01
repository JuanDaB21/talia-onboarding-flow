import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { imprimirComandas, type ComandaPrintData } from "@/components/preparacion/comanda-print";
import {
  isWebUSBSupported,
  getPairedPrinter,
  printComandaOnPairedPrinter,
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
  const [{ data: esp }, { data: cfg }] = await Promise.all([
    supabase.from("espacios_trabajo").select("slug, nombre"),
    supabase.from("espacio_impresora").select("id_espacio, ancho_papel_mm"),
  ]);
  const map = new Map<string, EspacioBasico>();
  const anchoPorEspacio = new Map<string, number>();
  for (const c of ((cfg ?? []) as Array<{ id_espacio: string; ancho_papel_mm: number }>)) {
    anchoPorEspacio.set(c.id_espacio, c.ancho_papel_mm);
  }
  // Necesitamos también el id → slug para cruzar; hacemos una segunda query si hace falta.
  const withIds = await supabase
    .from("espacios_trabajo")
    .select("id_espacio, slug, nombre");
  for (const e of (withIds.data ?? []) as Array<{ id_espacio: string; slug: string; nombre: string }>) {
    map.set(e.slug.toUpperCase(), {
      slug: e.slug.toUpperCase(),
      nombre: e.nombre,
      ancho_papel_mm: anchoPorEspacio.get(e.id_espacio) ?? 80,
    });
  }
  // silencio warnings si esp está sin usar
  void esp;
  return map;
}

async function loadNegocio(): Promise<string> {
  try {
    const { data } = await supabase
      .from("negocio")
      .select("nombre_comercial")
      .limit(1)
      .maybeSingle();
    return (data?.nombre_comercial as string) ?? "";
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
  switch (err) {
    case "impresora_desconectada":
      return "Impresora desconectada o apagada";
    case "sin_pareo":
      return "Sin impresora vinculada";
    case "webusb_no_soportado":
      return "Navegador sin soporte USB";
    default:
      return err ? `Error: ${err}` : "Error de impresión";
  }
}

// -------- Hook para Operación en vivo -------- //

export function usePrinterAlerts(): PrinterAlert[] {
  const [alerts, setAlerts] = useState<PrinterAlert[]>(() => getPrinterAlerts());
  useEffect(() => subscribePrinterAlerts(setAlerts), []);
  return alerts;
}
