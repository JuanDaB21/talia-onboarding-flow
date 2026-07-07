// Storage vía backend Talia. Subida con URL prefirmada (PUT directo al bucket)
// y lectura por proxy del backend (/storage/pub|priv).
import { useEffect, useState } from "react";
import { api, getTokens } from "@/lib/api-client";

export type StorageScope = "producto" | "logo" | "qr" | "comprobante";

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
 * Sube un archivo: pide URL prefirmada, hace PUT al bucket y devuelve la `path`
 * (relativa a la API, la que se guarda en la fila) y la `key` del objeto.
 */
export async function uploadToStorage(
  scope: StorageScope,
  file: File | Blob,
): Promise<{ path: string; key: string }> {
  const contentType = (file as File).type || "application/octet-stream";
  const { key, uploadUrl, path } = await api.post<{ key: string; uploadUrl: string; path: string }>(
    "/storage/upload-url",
    { scope, contentType },
  );
  const put = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "content-type": contentType },
    body: file,
  });
  if (!put.ok) throw new Error("No se pudo subir el archivo");
  return { path, key };
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
