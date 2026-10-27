import { useEffect, useRef, useState } from "react";
import type { CartaFondo } from "@/lib/menu-publico.functions";
import type { MenuTheme } from "@/lib/menu-themes";
import { publicUrl } from "@/lib/storage";

// El video no se baja si el visitante pidió menos movimiento, ahorro de datos o va en 2G:
// en esos casos queda el poster (o la imagen), que es lo que pinta primero de todas formas.
function videoPermitido(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return false;
  const conn = (
    navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }
  ).connection;
  if (conn?.saveData) return false;
  if (conn?.effectiveType && /(^|-)2g$/.test(conn.effectiveType)) return false;
  return true;
}

const enIdle = (fn: () => void): (() => void) => {
  const w = window as Window & {
    requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number;
    cancelIdleCallback?: (id: number) => void;
  };
  if (w.requestIdleCallback) {
    const id = w.requestIdleCallback(fn, { timeout: 1500 });
    return () => w.cancelIdleCallback?.(id);
  }
  const id = window.setTimeout(fn, 400);
  return () => window.clearTimeout(id);
};

/**
 * Capa fija detrás de la carta con el fondo que el negocio configuró en Apariencia
 * (imagen o video) más un velo del color del tema para que el texto siempre se lea.
 * Va dentro de un contenedor con `isolation: isolate`; no usa `background-attachment:
 * fixed` porque iOS lo ignora. Sin fondo configurado pinta el `ambiente` del tema (si tiene).
 */
export function FondoMedia({ fondo, theme }: { fondo?: CartaFondo | null; theme: MenuTheme }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [videoListo, setVideoListo] = useState(false);
  const tipo = fondo?.tipo ?? "NINGUNO";
  const url = publicUrl(fondo?.url ?? null);
  const poster = publicUrl(fondo?.poster ?? null);
  const imagen = tipo === "IMAGEN" ? url : tipo === "VIDEO" ? poster : null;
  const conMedia = (tipo === "IMAGEN" || tipo === "VIDEO") && !!url;

  useEffect(() => {
    setVideoListo(false);
    const v = videoRef.current;
    if (tipo !== "VIDEO" || !url || !v || !videoPermitido()) return;
    // iOS exige la *propiedad* muted (React solo pone el atributo) para el autoplay inline.
    v.muted = true;
    const cancelar = enIdle(() => {
      v.src = url;
      v.play().catch(() => {});
    });
    const onVisibilidad = () => {
      if (document.hidden) v.pause();
      else if (v.src) v.play().catch(() => {});
    };
    document.addEventListener("visibilitychange", onVisibilidad);
    return () => {
      cancelar();
      document.removeEventListener("visibilitychange", onVisibilidad);
      v.pause();
      v.removeAttribute("src");
      v.load();
    };
  }, [tipo, url]);

  if (!conMedia) {
    return theme.ambiente ? (
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10"
        style={{ background: theme.ambiente }}
      />
    ) : null;
  }

  const o = Math.min(90, Math.max(0, fondo?.oscurecer ?? 55));
  const velo = (pct: number) =>
    `color-mix(in oklab, var(--menu-bg) ${Math.min(97, Math.round(pct))}%, transparent)`;

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {imagen && (
        <img
          src={imagen}
          alt=""
          decoding="async"
          fetchPriority="low"
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}
      {tipo === "VIDEO" && (
        <video
          ref={videoRef}
          muted
          loop
          playsInline
          preload="none"
          disablePictureInPicture
          onPlaying={() => setVideoListo(true)}
          className="absolute inset-0 h-full w-full object-cover transition-opacity duration-1000"
          style={{ opacity: videoListo ? 1 : 0 }}
        />
      )}
      {/* Velo: más claro arriba (la portada luce el video) y más denso donde va la lista. */}
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(180deg, ${velo(o * 0.55)} 0%, ${velo(o * 0.8)} 35%, ${velo(o + 20)} 75%, ${velo(o + 30)} 100%)`,
        }}
      />
      <div className="menu-grano absolute inset-0" />
    </div>
  );
}
