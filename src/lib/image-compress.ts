// Compresión de imágenes en el navegador antes de subir por el backend.
// Menos bytes = subida más rápida y barata sobre la red móvil del mesero.
// Se aplica por `scope` con perfiles distintos según la necesidad.
import imageCompression from "browser-image-compression";
import type { StorageScope } from "@/lib/storage";

// Techo para la compresión: en un celular de poca RAM, decodificar una foto de
// 12+ MP en el web-worker puede colgarse sin resolver ni lanzar. Sin este límite,
// el `await compressForScope` quedaría pendiente para siempre y trabaría el pago.
const COMPRESS_TIMEOUT_MS = 8_000;

type Profile = {
  maxSizeMB: number;
  maxWidthOrHeight: number;
  initialQuality: number;
  /** Fuerza el mime de salida; si se omite, conserva el del archivo original. */
  fileType?: string;
};

// Comprobantes: prioriza velocidad/peso, la calidad no importa (se lee un monto).
// Producto/logo: mantienen calidad pero con tope de tamaño razonable. El logo
// conserva su tipo original (puede ser PNG con transparencia).
const PROFILES: Record<StorageScope, Profile> = {
  comprobante: {
    maxSizeMB: 0.3,
    maxWidthOrHeight: 1280,
    initialQuality: 0.6,
    fileType: "image/jpeg",
  },
  producto: { maxSizeMB: 1, maxWidthOrHeight: 1600, initialQuality: 0.85 },
  logo: { maxSizeMB: 0.5, maxWidthOrHeight: 800, initialQuality: 0.85 },
  qr: { maxSizeMB: 0.5, maxWidthOrHeight: 1000, initialQuality: 0.8 },
};

/**
 * Comprime `file` según el `scope`. Devuelve el archivo comprimido, o el
 * original si no es una imagen rasterizada (PDF, SVG, GIF), si la compresión
 * falla, o si el resultado no mejora el tamaño. Nunca lanza.
 */
export async function compressForScope(
  scope: StorageScope,
  file: File | Blob,
): Promise<File | Blob> {
  const type = (file as File).type || "";
  // Solo imágenes rasterizadas. Los comprobantes pueden ser PDF; SVG/GIF no se
  // benefician (vector / animado) y podrían degradarse.
  if (!type.startsWith("image/") || type === "image/svg+xml" || type === "image/gif") {
    return file;
  }

  const p = PROFILES[scope];
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    // Race contra un timeout: si el worker se cuelga, seguimos con el original en
    // vez de dejar la promesa pendiente para siempre (mismo espíritu que el catch).
    const compressed = await Promise.race([
      imageCompression(file as File, {
        maxSizeMB: p.maxSizeMB,
        maxWidthOrHeight: p.maxWidthOrHeight,
        initialQuality: p.initialQuality,
        useWebWorker: true,
        fileType: p.fileType,
      }),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error("compress-timeout")),
          COMPRESS_TIMEOUT_MS,
        );
      }),
    ]);
    // Si por alguna razón quedó igual o más grande, usa el original.
    return compressed.size < (file as File).size ? compressed : file;
  } catch {
    // Fallback: subir el original antes que bloquear el flujo de pago/carga.
    return file;
  } finally {
    if (timer) clearTimeout(timer);
  }
}
