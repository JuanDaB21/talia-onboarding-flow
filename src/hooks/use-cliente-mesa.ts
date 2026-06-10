import { useEffect, useState } from "react";

export interface ClienteMesa {
  idCliente: string;
  nombre: string;
  idSesion?: string;
}

function keyFor(idMesa: string) {
  return `talia.prepedido.${idMesa}`;
}

function leer(idMesa: string): ClienteMesa | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(keyFor(idMesa));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ClienteMesa;
    if (!parsed.idCliente || !parsed.nombre) return null;
    return parsed;
  } catch {
    return null;
  }
}

function escribir(idMesa: string, value: ClienteMesa) {
  if (typeof window === "undefined") return;
  localStorage.setItem(keyFor(idMesa), JSON.stringify(value));
}

export function useClienteMesa(idMesa: string) {
  const [cliente, setCliente] = useState<ClienteMesa | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setCliente(leer(idMesa));
    setHydrated(true);
  }, [idMesa]);

  const registrar = (nombre: string, idSesion?: string) => {
    const prev = leer(idMesa);
    const idCliente =
      prev?.idCliente ??
      (typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `c_${Math.random().toString(36).slice(2)}-${Date.now()}`);
    const next: ClienteMesa = { idCliente, nombre: nombre.trim(), idSesion };
    escribir(idMesa, next);
    setCliente(next);
    return next;
  };

  const setSesion = (idSesion: string) => {
    if (!cliente) return;
    const next = { ...cliente, idSesion };
    escribir(idMesa, next);
    setCliente(next);
  };

  return { cliente, hydrated, registrar, setSesion };
}
