// Carrito de la carta pública (domicilio / recoger). Vive en el navegador del cliente y se
// persiste por negocio en localStorage (best effort: en modo privado simplemente no persiste).
// Los precios aquí son solo para mostrar; el backend los recalcula al crear el pedido.
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ItemPedidoDomicilio, TipoEntrega } from "@/lib/domicilios-publico.functions";

export interface LineaCarrito {
  /** Firma de producto + modificadores: líneas iguales se suman. */
  key: string;
  id_producto: string;
  nombre: string;
  url_imagen: string | null;
  /** Precio unitario mostrado = base + variantes + extras. */
  precio_unitario: number;
  cantidad: number;
  nota: string;
  extras: Array<{ id_insumo_extra: string; nombre: string; precio: number }>;
  exclusiones: Array<{ id_insumo: string; nombre: string }>;
  variantes: Array<{ id_opcion: string; nombre: string; precio_delta: number }>;
}

export type NuevaLinea = Omit<LineaCarrito, "key" | "cantidad"> & { cantidad?: number };

interface EstadoCarrito {
  lineas: LineaCarrito[];
  tipo: TipoEntrega;
}

const MAX_UNIDADES_LINEA = 20;

function storageKey(idNegocio: string) {
  return `talia:carrito:${idNegocio}`;
}

function leer(idNegocio: string): EstadoCarrito {
  try {
    const raw = localStorage.getItem(storageKey(idNegocio));
    if (raw) {
      const v = JSON.parse(raw) as EstadoCarrito;
      if (Array.isArray(v.lineas)) return { lineas: v.lineas, tipo: v.tipo ?? "DOMICILIO" };
    }
  } catch {
    /* sin storage: carrito en memoria */
  }
  return { lineas: [], tipo: "DOMICILIO" };
}

export function firmaLinea(
  l: Pick<LineaCarrito, "id_producto" | "nota" | "extras" | "exclusiones" | "variantes">,
) {
  const ids = (xs: Array<Record<string, unknown>>, k: string) =>
    xs
      .map((x) => String(x[k]))
      .sort()
      .join(",");
  return [
    l.id_producto,
    ids(l.variantes, "id_opcion"),
    ids(l.extras, "id_insumo_extra"),
    ids(l.exclusiones, "id_insumo"),
    l.nota.trim().toLowerCase(),
  ].join("|");
}

export function useCarrito(idNegocio: string) {
  // SSR: arranca vacío y se hidrata en el cliente.
  const [estado, setEstado] = useState<EstadoCarrito>({ lineas: [], tipo: "DOMICILIO" });
  const [hidratado, setHidratado] = useState(false);

  useEffect(() => {
    setEstado(leer(idNegocio));
    setHidratado(true);
  }, [idNegocio]);

  useEffect(() => {
    if (!hidratado) return;
    try {
      localStorage.setItem(storageKey(idNegocio), JSON.stringify(estado));
    } catch {
      /* sin storage */
    }
  }, [estado, hidratado, idNegocio]);

  const agregar = useCallback((n: NuevaLinea) => {
    const key = firmaLinea(n);
    const cant = n.cantidad ?? 1;
    setEstado((s) => {
      const existe = s.lineas.find((l) => l.key === key);
      const lineas = existe
        ? s.lineas.map((l) =>
            l.key === key ? { ...l, cantidad: Math.min(MAX_UNIDADES_LINEA, l.cantidad + cant) } : l,
          )
        : [...s.lineas, { ...n, key, cantidad: Math.min(MAX_UNIDADES_LINEA, cant) }];
      return { ...s, lineas };
    });
  }, []);

  const cambiarCantidad = useCallback((key: string, cantidad: number) => {
    setEstado((s) => ({
      ...s,
      lineas:
        cantidad <= 0
          ? s.lineas.filter((l) => l.key !== key)
          : s.lineas.map((l) =>
              l.key === key ? { ...l, cantidad: Math.min(MAX_UNIDADES_LINEA, cantidad) } : l,
            ),
    }));
  }, []);

  const setTipo = useCallback((tipo: TipoEntrega) => setEstado((s) => ({ ...s, tipo })), []);
  const vaciar = useCallback(() => setEstado((s) => ({ ...s, lineas: [] })), []);

  const resumen = useMemo(() => {
    const unidades = estado.lineas.reduce((a, l) => a + l.cantidad, 0);
    const subtotal = estado.lineas.reduce((a, l) => a + l.precio_unitario * l.cantidad, 0);
    const porProducto = new Map<string, number>();
    for (const l of estado.lineas)
      porProducto.set(l.id_producto, (porProducto.get(l.id_producto) ?? 0) + l.cantidad);
    return { unidades, subtotal, porProducto };
  }, [estado.lineas]);

  return { ...estado, ...resumen, hidratado, agregar, cambiarCantidad, setTipo, vaciar };
}

export type Carrito = ReturnType<typeof useCarrito>;

export function lineasAItems(lineas: LineaCarrito[]): ItemPedidoDomicilio[] {
  return lineas.map((l) => ({
    id_producto: l.id_producto,
    cantidad: l.cantidad,
    nota: l.nota.trim() || null,
    tiene_alergia: false,
    extras: l.extras.map((e) => ({ id_insumo_extra: e.id_insumo_extra })),
    exclusiones: l.exclusiones.map((x) => ({ id_insumo: x.id_insumo })),
    variantes: l.variantes.map((v) => ({ id_opcion: v.id_opcion })),
  }));
}

// ── Pedidos hechos desde este navegador (banner "Tu pedido en curso") ─────────
export interface PedidoReciente {
  token: string;
  codigo: string;
  creado: number;
}

function pedidosKey(idNegocio: string) {
  return `talia:pedidos:${idNegocio}`;
}

export function guardarPedidoReciente(idNegocio: string, p: PedidoReciente) {
  try {
    const prev = leerPedidosRecientes(idNegocio).filter((x) => x.token !== p.token);
    localStorage.setItem(pedidosKey(idNegocio), JSON.stringify([p, ...prev].slice(0, 5)));
  } catch {
    /* sin storage */
  }
}

/** Pedidos de las últimas 24 h hechos desde este navegador. */
export function leerPedidosRecientes(idNegocio: string): PedidoReciente[] {
  try {
    const raw = localStorage.getItem(pedidosKey(idNegocio));
    const xs = raw ? (JSON.parse(raw) as PedidoReciente[]) : [];
    const limite = Date.now() - 24 * 60 * 60 * 1000;
    return xs.filter((x) => x && x.token && x.creado > limite);
  } catch {
    return [];
  }
}

/** Datos del cliente recordados para el próximo pedido (nombre, celular, dirección). */
export interface DatosCliente {
  nombre: string;
  telefono: string;
  direccion: string;
  referencia: string;
  id_municipio: string;
}

const CLIENTE_KEY = "talia:cliente";

export function leerDatosCliente(): Partial<DatosCliente> {
  try {
    const raw = localStorage.getItem(CLIENTE_KEY);
    return raw ? (JSON.parse(raw) as Partial<DatosCliente>) : {};
  } catch {
    return {};
  }
}

export function guardarDatosCliente(d: DatosCliente) {
  try {
    localStorage.setItem(CLIENTE_KEY, JSON.stringify(d));
  } catch {
    /* sin storage */
  }
}
