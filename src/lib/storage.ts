// Storage vía backend Talia. Subida y lectura por proxy del backend
// (/storage/upload y /storage/pub|priv): el navegador solo habla con el backend,
// nunca hace fetch directo al bucket (evita "Failed to fetch" por CORS/alcance).
import { useEffect, useState } from "react";
import { api, getTokens, fetchConTimeout } from "@/lib/api-client";
import { compressForScope } from "@/lib/image-compress";

export type StorageScope = "producto" | "logo" | "qr" | "comprobante";

// Subir bytes tarda más que una llamada JSON, así que el techo es más generoso
// que el de `api-client`. Pero DEBE existir: sin timeout, un POST que se estanca
// sobre una red móvil no rechaza nunca → el `finally` del que sube jamás corre y
// el spinner queda congelado, dejando el botón de pago deshabilitado para siempre.
const UPLOAD_TIMEOUT_MS = 30_000;

function backendOrigin(): string {
  try {
    return new URL(api.url).origin;
  } catch {
    return "";
  }
}

/** URL absoluta de un objeto público (fotos de producto, logos): se puede usar en <img src>. */
export function publicUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  return `${backendOrigin()}${path}`;
}

/**
 * Sube un archivo por el backend (`POST /storage/upload`) y devuelve la `path`
 * (relativa a la API, la que se guarda en la fila) y la `key` del objeto. El
 * backend sube al bucket; el navegador no hace PUT directo al bucket.
 */
export async function uploadToStorage(
  scope: StorageScope,
  file: File | Blob,
): Promise<{ path: string; key: string }> {
  // Comprimir en el navegador antes de subir (menos bytes = más rápido). El
  // contentType debe corresponder al blob que realmente se sube.
  const toUpload = await compressForScope(scope, file);
  const contentType = (toUpload as File).type || "application/octet-stream";
  const tokens = getTokens();
  let res: Response;
  try {
    res = await fetchConTimeout(
      `${api.url}/storage/upload?scope=${encodeURIComponent(scope)}`,
      {
        method: "POST",
        headers: {
          "content-type": contentType,
          ...(tokens ? { authorization: `Bearer ${tokens.access}` } : {}),
        },
        body: toUpload,
      },
      UPLOAD_TIMEOUT_MS,
    );
  } catch (err) {
    // El AbortController de `fetchConTimeout` rechaza con TimeoutError al vencer;
    // lo traducimos a un mensaje accionable para el mesero (red lenta, reintentar).
    if (err instanceof DOMException && err.name === "TimeoutError") {
      throw new Error("La red está lenta, no se pudo subir. Intenta de nuevo.");
    }
    throw err;
  }
  if (!res.ok) throw new Error("No se pudo subir el archivo");
  return (await res.json()) as { path: string; key: string };
}

/**
 * Descarga un objeto privado (QR de pago, comprobantes) con el JWT y lo expone
 * como object URL para <img>. Los objetos privados no se pueden pedir directo
 * desde <img src> porque requieren Authorization.
 */
export async function fetchPrivObjectUrl(path: string): Promise<string> {
  const tokens = getTokens();
  const res = await fetch(`${backendOrigin()}${path}`, {
    headers: tokens ? { authorization: `Bearer ${tokens.access}` } : {},
  });
  if (!res.ok) throw new Error("No se pudo cargar la imagen");
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

/** Hook que resuelve un object URL para un path privado y lo libera al desmontar. */
export function usePrivImage(path: string | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!path) {
      setUrl(null);
      return;
    }
    let revoke: string | null = null;
    let cancel = false;
    fetchPrivObjectUrl(path)
      .then((u) => {
        if (cancel) {
          URL.revokeObjectURL(u);
          return;
        }
        revoke = u;
        setUrl(u);
      })
      .catch(() => setUrl(null));
    return () => {
      cancel = true;
      if (revoke) URL.revokeObjectURL(revoke);
    };
  }, [path]);
  return url;
}
