import type { CartaProducto } from "@/lib/menu-publico.functions";

const normalizar = (t: string) =>
  t
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");

/** Filtra por nombre/descripción ignorando mayúsculas y tildes. */
export function filtrarPorBusqueda(productos: CartaProducto[], busqueda: string): CartaProducto[] {
  const q = normalizar(busqueda.trim());
  if (!q) return productos;
  return productos.filter((p) =>
    normalizar(`${p.nombre_producto} ${p.descripcion_producto ?? ""}`).includes(q),
  );
}
