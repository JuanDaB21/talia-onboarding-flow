import { useEffect } from "react";
import { getThemeFontsUrls } from "@/lib/menu-themes";

const PRECONNECT: Record<string, string[]> = {
  "fonts.googleapis.com": ["https://fonts.googleapis.com", "https://fonts.gstatic.com"],
  "api.fontshare.com": ["https://api.fontshare.com", "https://cdn.fontshare.com"],
};

function agregarLink(id: string, rel: string, href: string, crossOrigin = false) {
  if (document.getElementById(id)) return;
  const link = document.createElement("link");
  link.id = id;
  link.rel = rel;
  link.href = href;
  if (crossOrigin) link.crossOrigin = "anonymous";
  document.head.appendChild(link);
}

/**
 * Inyecta (una sola vez por tema) las hojas de fuentes del tema de la carta, con
 * `preconnect` a su proveedor. Las hojas usan `display=swap`: el texto pinta con la
 * fuente de sistema y cambia al llegar la web font (sin FOIT).
 */
export function useMenuFonts(themeId: string | null | undefined) {
  useEffect(() => {
    if (!themeId) return;
    getThemeFontsUrls(themeId).forEach((href, i) => {
      const host = new URL(href).host;
      (PRECONNECT[host] ?? []).forEach((origin) =>
        agregarLink(`menu-preconnect-${new URL(origin).host}`, "preconnect", origin, true),
      );
      agregarLink(`menu-fonts-${themeId}-${i}`, "stylesheet", href);
    });
  }, [themeId]);
}
