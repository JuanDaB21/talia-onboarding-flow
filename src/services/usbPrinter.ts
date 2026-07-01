/**
 * WebUSB thermal printer bridge (ESC/POS).
 *
 * Pairing per espacio de trabajo (keyed by slug UPPERCASE). Each browser
 * profile stores its own pairing; the OS never exposes the printer list to
 * the app, only the specific device the user picked.
 *
 * Only Chromium-based desktop browsers support navigator.usb.
 */

import type { ComandaPrintData, ComandaItemPrint } from "@/components/preparacion/comanda-print";

// ---------- Types (avoid depending on @types/w3c-web-usb) ---------- //

type USBEndpointDirection = "in" | "out";
interface USBEndpoint {
  endpointNumber: number;
  direction: USBEndpointDirection;
  type: string;
}
interface USBAlternateInterface {
  interfaceNumber: number;
  alternateSetting: number;
  interfaceClass: number;
  endpoints: USBEndpoint[];
}
interface USBInterface {
  interfaceNumber: number;
  alternate: USBAlternateInterface;
  claimed: boolean;
}
interface USBConfiguration {
  configurationValue: number;
  interfaces: USBInterface[];
}
export interface USBDevice {
  vendorId: number;
  productId: number;
  serialNumber?: string | null;
  productName?: string | null;
  manufacturerName?: string | null;
  opened: boolean;
  configuration: USBConfiguration | null;
  configurations: USBConfiguration[];
  open(): Promise<void>;
  close(): Promise<void>;
  selectConfiguration(v: number): Promise<void>;
  claimInterface(n: number): Promise<void>;
  releaseInterface(n: number): Promise<void>;
  transferOut(endpointNumber: number, data: ArrayBuffer): Promise<{ status: string; bytesWritten: number }>;
}
interface USB extends EventTarget {
  getDevices(): Promise<USBDevice[]>;
  requestDevice(options: { filters: Array<{ vendorId?: number; productId?: number; classCode?: number }> }): Promise<USBDevice>;
}

declare global {
  interface Navigator {
    usb?: USB;
  }
}

// ---------- Pairing store (localStorage) ---------- //

export interface PairedPrinter {
  slug: string; // UPPERCASE slug del espacio
  vendorId: number;
  productId: number;
  serialNumber: string | null;
  productName: string | null;
  manufacturerName: string | null;
  pairedAt: string;
}

const STORAGE_PREFIX = "talia.printer.";

export function isWebUSBSupported(): boolean {
  return typeof navigator !== "undefined" && !!navigator.usb;
}

function keyFor(slug: string): string {
  return `${STORAGE_PREFIX}${slug.toUpperCase()}`;
}

export function getPairedPrinter(slug: string): PairedPrinter | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(keyFor(slug));
    if (!raw) return null;
    return JSON.parse(raw) as PairedPrinter;
  } catch {
    return null;
  }
}

export function listPairings(): PairedPrinter[] {
  if (typeof window === "undefined") return [];
  const out: PairedPrinter[] = [];
  for (let i = 0; i < window.localStorage.length; i++) {
    const k = window.localStorage.key(i);
    if (!k || !k.startsWith(STORAGE_PREFIX)) continue;
    try {
      const raw = window.localStorage.getItem(k);
      if (raw) out.push(JSON.parse(raw) as PairedPrinter);
    } catch {
      /* ignore */
    }
  }
  return out;
}

function savePairing(p: PairedPrinter) {
  window.localStorage.setItem(keyFor(p.slug), JSON.stringify(p));
  emitPairingEvent();
}

export function unpairPrinter(slug: string) {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(keyFor(slug));
  emitPairingEvent();
}

// ---------- Event bus (pairing + print outcomes) ---------- //

type PairingListener = () => void;
const pairingListeners = new Set<PairingListener>();
export function subscribePairing(fn: PairingListener): () => void {
  pairingListeners.add(fn);
  return () => pairingListeners.delete(fn);
}
function emitPairingEvent() {
  pairingListeners.forEach((l) => {
    try {
      l();
    } catch {
      /* ignore */
    }
  });
}

// ---------- Device resolution ---------- //

async function resolveDevice(p: PairedPrinter): Promise<USBDevice | null> {
  if (!navigator.usb) return null;
  const devices = await navigator.usb.getDevices();
  return (
    devices.find(
      (d) =>
        d.vendorId === p.vendorId &&
        d.productId === p.productId &&
        (p.serialNumber ? d.serialNumber === p.serialNumber : true),
    ) ?? null
  );
}

/** Pide al usuario que elija un dispositivo USB y lo asocia al espacio. */
export async function requestAndPairPrinter(slug: string): Promise<PairedPrinter> {
  if (!navigator.usb) throw new Error("Este navegador no soporta WebUSB. Usa Chrome, Edge u Opera de escritorio.");
  // classCode 7 = Printer class. Muchas térmicas USB baratas no lo declaran,
  // así que pedimos también sin filtro cuando el usuario elige.
  const device = await navigator.usb.requestDevice({ filters: [{ classCode: 7 }, {}] });
  const paired: PairedPrinter = {
    slug: slug.toUpperCase(),
    vendorId: device.vendorId,
    productId: device.productId,
    serialNumber: device.serialNumber ?? null,
    productName: device.productName ?? null,
    manufacturerName: device.manufacturerName ?? null,
    pairedAt: new Date().toISOString(),
  };
  savePairing(paired);
  return paired;
}

// ---------- ESC/POS renderer ---------- //

const ESC = 0x1b;
const GS = 0x1d;

function bytes(...arr: number[]): Uint8Array {
  return new Uint8Array(arr);
}

function encText(s: string): Uint8Array {
  // CP437 con fallback ASCII: reemplaza tildes/ñ para no romper impresoras
  // configuradas en distintas codepages. Usuario avanzado puede migrar a CP858.
  const normalized = s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x00-\x7f]/g, "?");
  const out = new Uint8Array(normalized.length);
  for (let i = 0; i < normalized.length; i++) out[i] = normalized.charCodeAt(i) & 0x7f;
  return out;
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.length;
  }
  return out;
}

function line(text: string): Uint8Array {
  return concat(encText(text), bytes(0x0a));
}

function ancho(mm: number): number {
  // Aproximación: 80mm ≈ 42-48 chars, 58mm ≈ 32 chars
  return mm === 58 ? 32 : 48;
}

function separador(chars: number): Uint8Array {
  return line("-".repeat(chars));
}

function centrar(text: string, chars: number): string {
  if (text.length >= chars) return text;
  const pad = Math.floor((chars - text.length) / 2);
  return " ".repeat(pad) + text;
}

function renderComandaBytes(c: ComandaPrintData, negocio: string, anchoMm: number): Uint8Array {
  const chars = ancho(anchoMm);
  const partes: Uint8Array[] = [];
  // Init + codepage CP437
  partes.push(bytes(ESC, 0x40)); // ESC @
  partes.push(bytes(ESC, 0x74, 0x00)); // codepage 0 (CP437)
  partes.push(bytes(ESC, 0x61, 0x01)); // centrar

  // Destino grande
  partes.push(bytes(GS, 0x21, 0x11)); // doble ancho + alto
  partes.push(line(c.destino.toUpperCase()));
  partes.push(bytes(GS, 0x21, 0x00));

  if (negocio) partes.push(line(negocio));
  partes.push(bytes(GS, 0x21, 0x01)); // doble alto
  partes.push(line(`Mesa ${c.mesa_identificador}`));
  partes.push(bytes(GS, 0x21, 0x00));

  const fecha = new Date(c.pedido_created_at ?? Date.now()).toLocaleString("es-CO", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  partes.push(line(fecha));
  partes.push(line(`Pedido #${c.pedido_id.slice(0, 6)}${c.mesero ? ` · ${c.mesero}` : ""}`));

  partes.push(bytes(ESC, 0x61, 0x00)); // izquierda
  partes.push(separador(chars));

  const renderItem = (it: ComandaItemPrint) => {
    partes.push(bytes(ESC, 0x45, 0x01)); // bold on
    partes.push(bytes(GS, 0x21, 0x01)); // doble alto
    partes.push(line(`x${it.cantidad}  ${it.nombre_producto}`));
    partes.push(bytes(GS, 0x21, 0x00));
    partes.push(bytes(ESC, 0x45, 0x00)); // bold off

    (it.variantes ?? []).forEach((v) => partes.push(line(`  > ${v.nombre_grupo}: ${v.nombre_opcion}`)));
    (it.extras ?? []).forEach((e) => partes.push(line(`  + ${e.nombre}${e.cantidad && e.cantidad !== 1 ? ` (${e.cantidad})` : ""}`)));
    (it.exclusiones ?? []).forEach((x) => partes.push(line(`  - Sin ${x.nombre}`)));

    if (it.tiene_alergia) {
      partes.push(bytes(ESC, 0x45, 0x01));
      partes.push(line("  !! ALERGIA - PRECAUCION !!"));
      partes.push(bytes(ESC, 0x45, 0x00));
    }
    if (it.nota) partes.push(line(`  Nota: ${it.nota}`));
  };

  // Agrupar por subcategoria
  let currentSub: string | null | undefined = undefined;
  c.items.forEach((it) => {
    const sub = it.nombre_subcategoria ?? null;
    if (sub !== currentSub) {
      partes.push(bytes(ESC, 0x45, 0x01));
      partes.push(line((sub ?? "OTROS").toUpperCase()));
      partes.push(bytes(ESC, 0x45, 0x00));
      currentSub = sub;
    }
    renderItem(it);
  });

  partes.push(separador(chars));
  partes.push(bytes(ESC, 0x61, 0x01));
  partes.push(line("-- Fin de comanda --"));
  partes.push(bytes(ESC, 0x61, 0x00));

  // Alimentar y cortar
  partes.push(bytes(0x0a, 0x0a, 0x0a, 0x0a));
  partes.push(bytes(GS, 0x56, 0x42, 0x00)); // GS V B - full cut

  return concat(...partes);
}

// ---------- Print pipeline ---------- //

function pickOutEndpoint(device: USBDevice): { interfaceNumber: number; endpointNumber: number } | null {
  const cfg = device.configuration ?? device.configurations[0];
  if (!cfg) return null;
  for (const intf of cfg.interfaces) {
    const alt = intf.alternate;
    const ep = alt.endpoints.find((e) => e.direction === "out" && e.type === "bulk");
    if (ep) return { interfaceNumber: intf.interfaceNumber, endpointNumber: ep.endpointNumber };
  }
  return null;
}

async function sendBytesToDevice(device: USBDevice, data: Uint8Array): Promise<void> {
  if (!device.opened) await device.open();
  if (device.configuration == null) {
    const first = device.configurations[0]?.configurationValue ?? 1;
    await device.selectConfiguration(first);
  }
  const ep = pickOutEndpoint(device);
  if (!ep) throw new Error("La impresora no expone un endpoint de escritura.");
  await device.claimInterface(ep.interfaceNumber);
  try {
    // Chunk 4KB para evitar timeouts en impresoras lentas
    const CHUNK = 4096;
    for (let i = 0; i < data.length; i += CHUNK) {
      const slice = data.subarray(i, Math.min(i + CHUNK, data.length));
      const res = await device.transferOut(ep.endpointNumber, slice);
      if (res.status !== "ok") throw new Error(`transferOut status=${res.status}`);
    }
  } finally {
    try {
      await device.releaseInterface(ep.interfaceNumber);
    } catch {
      /* ignore */
    }
  }
}

export interface PrintOutcome {
  ok: boolean;
  error?: string;
}

export async function printComandaOnPairedPrinter(
  comanda: ComandaPrintData,
  opts: { negocio?: string; anchoMm?: number } = {},
): Promise<PrintOutcome> {
  const slug = comanda.destino.toUpperCase();
  const paired = getPairedPrinter(slug);
  if (!paired) return { ok: false, error: "sin_pareo" };
  if (!navigator.usb) return { ok: false, error: "webusb_no_soportado" };

  const device = await resolveDevice(paired);
  if (!device) return { ok: false, error: "impresora_desconectada" };

  try {
    const data = renderComandaBytes(comanda, opts.negocio ?? "", opts.anchoMm ?? 80);
    await sendBytesToDevice(device, data);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "error_desconocido" };
  }
}

export async function printPruebaOnPairedPrinter(slug: string, anchoMm: number): Promise<PrintOutcome> {
  const paired = getPairedPrinter(slug);
  if (!paired) return { ok: false, error: "sin_pareo" };
  const device = await resolveDevice(paired);
  if (!device) return { ok: false, error: "impresora_desconectada" };
  try {
    const partes: Uint8Array[] = [];
    partes.push(bytes(ESC, 0x40));
    partes.push(bytes(ESC, 0x61, 0x01));
    partes.push(bytes(GS, 0x21, 0x11));
    partes.push(line("TALIA"));
    partes.push(bytes(GS, 0x21, 0x00));
    partes.push(line("Prueba de impresion"));
    partes.push(line(new Date().toLocaleString("es-CO")));
    partes.push(line(centrar(`Espacio: ${slug}`, ancho(anchoMm))));
    partes.push(bytes(0x0a, 0x0a, 0x0a, 0x0a));
    partes.push(bytes(GS, 0x56, 0x42, 0x00));
    await sendBytesToDevice(device, concat(...partes));
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "error_desconocido" };
  }
}
