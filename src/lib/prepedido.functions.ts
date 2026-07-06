// Prepedido del comensal (carta pública) y vista mesero, vía REST del backend Talia.
// Flujo público → /prepedido/public/* (endpoints sin auth, funciones SECURITY DEFINER).
// Aceptar prepedido (staff) → /prepedido/mesas/:id/aceptar.
//
// Excepción: editarItemPrepedidoStaff/eliminarItemPrepedidoStaff siguen como server
// functions Supabase — el backend no expone un endpoint autenticado para que el staff
// edite/elimine items de prepedido de OTRO cliente (las RPC públicas validan id_cliente).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { api } from "@/lib/api-client";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ============================================================
// Tipos
// ============================================================

export interface PrepedidoSesion {
  id_sesion: string;
  id_cliente: string;
  nombre: string;
  created_at: string;
  last_seen_at: string;
}

export interface PrepedidoExtra {
  id_insumo_extra: string;
  nombre: string;
  precio: number;
}

export interface PrepedidoExclusion {
  id_insumo: string;
  nombre: string;
}

export interface PrepedidoVariante {
  id_opcion: string;
  id_grupo: string;
  nombre_grupo: string;
  nombre_opcion: string;
  precio_delta: number;
}

export interface PrepedidoItem {
  id_prepedido_item: string;
  id_sesion: string;
  id_cliente: string;
  nombre_cliente: string;
  id_producto: string;
  nombre_producto: string;
  cantidad: number;
  precio_unitario: number;
  tiene_alergia: boolean;
  nota: string | null;
  extras: PrepedidoExtra[];
  exclusiones: PrepedidoExclusion[];
  variantes: PrepedidoVariante[];
  subtotal: number;
  created_at: string;
}

export interface PrepedidoData {
  sesiones: PrepedidoSesion[];
  items: PrepedidoItem[];
  total: number;
}

// Opciones del producto para el editor del comensal (shapes aplanados por el backend).
export interface OpcionExtra {
  id_insumo_extra: string;
  cantidad_porcion: number;
  precio_extra: number;
  nombre_insumo: string;
  unidad_receta: string;
}
export interface OpcionIngrediente {
  id_insumo: string;
  cantidad: number;
  nombre_insumo: string;
  unidad_receta: string;
}
export interface OpcionVarianteOpcion {
  id_opcion: string;
  id_insumo_opcion: string;
  nombre_opcion: string;
  unidad_receta: string;
  cantidad_porcion: number;
  precio_delta: number;
}
export interface OpcionVarianteGrupo {
  id_grupo: string;
  nombre: string;
  seleccion: "UNICA" | "MULTIPLE";
  opciones: OpcionVarianteOpcion[];
}
export interface OpcionesProducto {
  extras: OpcionExtra[];
  ingredientes: OpcionIngrediente[];
  variantes: OpcionVarianteGrupo[];
}

// ============================================================
// Flujo público (comensal en la mesa, sin login) — /prepedido/public/*
// ============================================================

export function unirseSesionPrepedido(input: {
  idMesa: string;
  idCliente: string;
  nombre: string;
}): Promise<{ id_sesion: string }> {
  return api.post<{ id_sesion: string }>("/prepedido/public/unirse", {
    idMesa: input.idMesa,
    idCliente: input.idCliente,
    nombre: input.nombre.trim(),
  });
}

export function getPrepedidoPublico(idMesa: string): Promise<PrepedidoData> {
  return api.get<PrepedidoData>(`/prepedido/public/mesas/${idMesa}/estado`);
}

export function getOpcionesProductoPublico(input: {
  idMesa: string;
  idProducto: string;
}): Promise<OpcionesProducto> {
  return api.get<OpcionesProducto>(
    `/prepedido/public/mesas/${input.idMesa}/productos/${input.idProducto}/opciones`,
  );
}

export interface AgregarItemPrepedidoInput {
  idMesa: string;
  idSesion: string;
  idCliente: string;
  idProducto: string;
  cantidad: number;
  tieneAlergia?: boolean;
  nota?: string | null;
  extras: Array<{ id_insumo_extra: string }>;
  exclusiones: Array<{ id_insumo: string }>;
  variantes: Array<{ id_opcion: string }>;
}

export function agregarItemPrepedido(
  input: AgregarItemPrepedidoInput,
): Promise<{ id_prepedido_item: string }> {
  return api.post<{ id_prepedido_item: string }>("/prepedido/public/items", input);
}

export interface EditarItemPrepedidoInput {
  idItem: string;
  idCliente: string;
  cantidad: number;
  tieneAlergia?: boolean;
  nota?: string | null;
  extras: Array<{ id_insumo_extra: string }>;
  exclusiones: Array<{ id_insumo: string }>;
  variantes: Array<{ id_opcion: string }>;
}

export function editarItemPrepedido(input: EditarItemPrepedidoInput): Promise<{ ok: true }> {
  const { idItem, ...body } = input;
  return api.patch<{ ok: true }>(`/prepedido/public/items/${idItem}`, body);
}

export function eliminarItemPrepedido(input: {
  idItem: string;
  idCliente: string;
}): Promise<{ ok: true }> {
  return api.post<{ ok: true }>(`/prepedido/public/items/${input.idItem}/eliminar`, {
    idCliente: input.idCliente,
  });
}

// ============================================================
// Staff — aceptar prepedido (REST autenticado)
// ============================================================

export function aceptarPrepedido(input: { idMesa: string }): Promise<{ aceptados: number }> {
  return api.post<{ aceptados: number }>(`/prepedido/mesas/${input.idMesa}/aceptar`);
}

// ============================================================
// Staff — editar/eliminar item de prepedido (AÚN Supabase: sin endpoint backend)
// ============================================================

const uuid = z.string().uuid();

async function validarExtrasYExclusiones(
  idProducto: string,
  extras: Array<{ id_insumo_extra: string }>,
  exclusiones: Array<{ id_insumo: string }>,
) {
  if (extras.length > 0) {
    const ids = extras.map((e) => e.id_insumo_extra);
    const { data } = await supabaseAdmin
      .from("extras_permitidos")
      .select("id_insumo_extra")
      .eq("id_producto", idProducto)
      .in("id_insumo_extra", ids);
    const ok = new Set((data ?? []).map((d) => d.id_insumo_extra as string));
    for (const e of extras) {
      if (!ok.has(e.id_insumo_extra)) throw new Error("Extra no permitido");
    }
  }
  if (exclusiones.length > 0) {
    const { data: prod } = await supabaseAdmin
      .from("productos")
      .select("id_receta")
      .eq("id_producto", idProducto)
      .maybeSingle();
    if (!prod) throw new Error("Producto inválido");
    const ids = exclusiones.map((e) => e.id_insumo);
    const { data } = await supabaseAdmin
      .from("receta_detalle")
      .select("id_insumo")
      .eq("id_receta", prod.id_receta as string)
      .in("id_insumo", ids);
    const ok = new Set((data ?? []).map((d) => d.id_insumo as string));
    for (const x of exclusiones) {
      if (!ok.has(x.id_insumo)) throw new Error("Exclusión no válida");
    }
  }
}

// Resuelve snapshots de variantes (nombre y precio) validando contra la receta del producto
async function resolverVariantes(
  idProducto: string,
  variantes: Array<{ id_opcion: string }>,
): Promise<
  Array<{
    id_opcion: string;
    id_grupo: string;
    id_insumo_opcion: string;
    nombre_grupo: string;
    nombre_opcion: string;
    precio_delta: number;
    cantidad_porcion: number;
  }>
> {
  if (variantes.length === 0) return [];

  const { data: prod } = await supabaseAdmin
    .from("productos")
    .select("id_receta")
    .eq("id_producto", idProducto)
    .maybeSingle();
  if (!prod) throw new Error("Producto inválido");
  const idReceta = prod.id_receta as string;

  const ids = variantes.map((v) => v.id_opcion);
  const { data, error } = await supabaseAdmin
    .from("producto_variante_opciones")
    .select(
      "id_opcion, id_grupo, id_insumo_opcion, precio_delta, cantidad_porcion, producto_variante_grupos:id_grupo(id_receta, nombre), insumos:id_insumo_opcion(nombre_insumo)",
    )
    .in("id_opcion", ids);
  if (error) throw new Error(error.message);

  const map = new Map<
    string,
    {
      id_opcion: string;
      id_grupo: string;
      id_insumo_opcion: string;
      nombre_grupo: string;
      nombre_opcion: string;
      precio_delta: number;
      cantidad_porcion: number;
    }
  >();
  for (const raw of (data ?? []) as unknown as Array<Record<string, unknown>>) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const g = (raw as any).producto_variante_grupos;
    if (!g || g.id_receta !== idReceta) continue;
    map.set(raw.id_opcion as string, {
      id_opcion: raw.id_opcion as string,
      id_grupo: raw.id_grupo as string,
      id_insumo_opcion: raw.id_insumo_opcion as string,
      nombre_grupo: (g.nombre as string) ?? "",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      nombre_opcion: ((raw as any).insumos?.nombre_insumo as string) ?? "—",
      precio_delta: Number(raw.precio_delta ?? 0),
      cantidad_porcion: Number(raw.cantidad_porcion ?? 0),
    });
  }
  const out: Array<{
    id_opcion: string;
    id_grupo: string;
    id_insumo_opcion: string;
    nombre_grupo: string;
    nombre_opcion: string;
    precio_delta: number;
    cantidad_porcion: number;
  }> = [];
  for (const v of variantes) {
    const snap = map.get(v.id_opcion);
    if (!snap) throw new Error("Variante no permitida");
    out.push(snap);
  }
  return out;
}

const editarStaffSchema = z.object({
  idItem: uuid,
  cantidad: z.number().int().min(1).max(50),
  tieneAlergia: z.boolean().optional().default(false),
  nota: z.string().max(300).optional().nullable(),
  extras: z.array(z.object({ id_insumo_extra: uuid })).default([]),
  exclusiones: z.array(z.object({ id_insumo: uuid })).default([]),
  variantes: z.array(z.object({ id_opcion: uuid })).default([]),
});

async function verificarMesaStaff(
  supabase: {
    from: (t: string) => {
      select: (s: string) => {
        eq: (
          c: string,
          v: string,
        ) => { maybeSingle: () => Promise<{ data: unknown; error: { message: string } | null }> };
      };
    };
  },
  idMesa: string,
) {
  const { data, error } = await supabase
    .from("mesas")
    .select("id_mesa")
    .eq("id_mesa", idMesa)
    .maybeSingle();
  if (error) throw new Error((error as { message: string }).message);
  if (!data) throw new Error("No autorizado");
}

export const editarItemPrepedidoStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => editarStaffSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: item, error } = await supabaseAdmin
      .from("prepedido_items")
      .select("id_prepedido_item, id_mesa, id_producto")
      .eq("id_prepedido_item", data.idItem)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!item) throw new Error("Item no encontrado");

    await verificarMesaStaff(
      context.supabase as unknown as Parameters<typeof verificarMesaStaff>[0],
      item.id_mesa as string,
    );
    await validarExtrasYExclusiones(item.id_producto as string, data.extras, data.exclusiones);
    const variantesSnap = await resolverVariantes(item.id_producto as string, data.variantes);

    const { error: uErr } = await supabaseAdmin
      .from("prepedido_items")
      .update({
        cantidad: data.cantidad,
        tiene_alergia: !!data.tieneAlergia,
        nota: data.nota?.trim() || null,
        extras: data.extras,
        exclusiones: data.exclusiones,
        variantes: variantesSnap,
      })
      .eq("id_prepedido_item", data.idItem);
    if (uErr) throw new Error(uErr.message);
    return { ok: true };
  });

export const eliminarItemPrepedidoStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ idItem: uuid }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: item, error } = await supabaseAdmin
      .from("prepedido_items")
      .select("id_prepedido_item, id_mesa")
      .eq("id_prepedido_item", data.idItem)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!item) return { ok: true };
    await verificarMesaStaff(
      context.supabase as unknown as Parameters<typeof verificarMesaStaff>[0],
      item.id_mesa as string,
    );
    const { error: dErr } = await supabaseAdmin
      .from("prepedido_items")
      .delete()
      .eq("id_prepedido_item", data.idItem);
    if (dErr) throw new Error(dErr.message);
    return { ok: true };
  });
