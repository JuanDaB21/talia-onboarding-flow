// Compresión de imágenes en el navegador antes de subir al bucket.
// La subida usa URL prefirmada (PUT directo a S3), así que los bytes nunca
// pasan por el backend: comprimir aquí es la única forma de optimizar peso y
// velocidad. Se aplica por `scope` con perfiles distintos según la necesidad.
import imageCompression from "browser-image-compression";
import type { StorageScope } from "@/lib/storage";

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
  try {
    const compressed = await imageCompression(file as File, {
      maxSizeMB: p.maxSizeMB,
      maxWidthOrHeight: p.maxWidthOrHeight,
      initialQuality: p.initialQuality,
      useWebWorker: true,
      fileType: p.fileType,
    });
    // Si por alguna razón quedó igual o más grande, usa el original.
    return compressed.size < (file as File).size ? compressed : file;
  } catch {
    // Fallback: subir el original antes que bloquear el flujo de pago/carga.
    return file;
  }
}
