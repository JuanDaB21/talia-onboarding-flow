import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { guardarVariantesSchema } from "@/lib/menu-schemas";

export interface VarianteOpcion {
  id_opcion: string;
  id_producto_opcion: string;
  nombre_producto_opcion: string;
  precio_delta: number;
  orden: number;
}

export interface VarianteGrupo {
  id_grupo: string;
  nombre: string;
  seleccion: "UNICA" | "MULTIPLE";
  orden: number;
  opciones: VarianteOpcion[];
}

const idProductoSchema = z.object({ idProducto: z.string().uuid() });

async function cargarGrupos(
  supabase: {
    from: (t: string) => {
      select: (s: string) => {
        in: (col: string, v: string[]) => Promise<{ data: unknown; error: { message: string } | null }>;
        eq: (col: string, v: string) => {
          order: (c: string, o?: { ascending: boolean }) => Promise<{ data: unknown; error: { message: string } | null }>;
        };
      };
    };
  },
  idProducto: string,
): Promise<VarianteGrupo[]> {
  const { data: grupos, error } = await supabase
    .from("producto_variante_grupos")
    .select("id_grupo, nombre, seleccion, orden")
    .eq("id_producto", idProducto)
    .order("orden", { ascending: true });
  if (error) throw new Error(error.message);

  const gs = (grupos ?? []) as Array<{ id_grupo: string; nombre: string; seleccion: "UNICA" | "MULTIPLE"; orden: number }>;
  if (gs.length === 0) return [];
  const ids = gs.map((g) => g.id_grupo);

  const { data: opciones, error: oErr } = await supabase
    .from("producto_variante_opciones")
    .select("id_opcion, id_grupo, id_producto_opcion, precio_delta, orden, productos:id_producto_opcion(nombre_producto)")
    .in("id_grupo", ids);
  if (oErr) throw new Error(oErr.message);

  const byGrupo = new Map<string, VarianteOpcion[]>();
  for (const raw of (opciones ?? []) as Array<Record<string, unknown>>) {
    const idg = raw.id_grupo as string;
    const arr = byGrupo.get(idg) ?? [];
    arr.push({
      id_opcion: raw.id_opcion as string,
      id_producto_opcion: raw.id_producto_opcion as string,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      nombre_producto_opcion: ((raw as any).productos?.nombre_producto as string) ?? "—",
      precio_delta: Number(raw.precio_delta ?? 0),
      orden: Number(raw.orden ?? 0),
    });
    byGrupo.set(idg, arr);
  }
  byGrupo.forEach((arr) =>
    arr.sort((a, b) => a.orden - b.orden || a.nombre_producto_opcion.localeCompare(b.nombre_producto_opcion)),
  );

  return gs.map((g) => ({
    id_grupo: g.id_grupo,
    nombre: g.nombre,
    seleccion: g.seleccion,
    orden: Number(g.orden ?? 0),
    opciones: byGrupo.get(g.id_grupo) ?? [],
  }));
}

export const listarVariantesProducto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => idProductoSchema.parse(input))
  .handler(async ({ data, context }): Promise<VarianteGrupo[]> => {
    return cargarGrupos(
      context.supabase as unknown as Parameters<typeof cargarGrupos>[0],
      data.idProducto,
    );
  });

export const guardarVariantesProducto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => guardarVariantesSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    // RLS asegura que el producto pertenezca al negocio
    const { data: prod, error: pErr } = await supabase
      .from("productos")
      .select("id_producto")
      .eq("id_producto", data.idProducto)
      .maybeSingle();
    if (pErr) throw new Error(pErr.message);
    if (!prod) throw new Error("Producto no encontrado");

    // No permitir auto-referencia
    for (const g of data.grupos) {
      for (const o of g.opciones) {
        if (o.id_producto_opcion === data.idProducto) {
          throw new Error("Una variante no puede apuntar al mismo producto");
        }
      }
    }

    // Estrategia simple y segura: borrar todos los grupos del producto y reinsertar.
    // RLS impide tocar grupos ajenos.
    const { error: dErr } = await supabase
      .from("producto_variante_grupos")
      .delete()
      .eq("id_producto", data.idProducto);
    if (dErr) throw new Error(dErr.message);

    for (let gi = 0; gi < data.grupos.length; gi++) {
      const g = data.grupos[gi];
      const { data: gIns, error: gErr } = await supabase
        .from("producto_variante_grupos")
        .insert({
          id_producto: data.idProducto,
          nombre: g.nombre.trim(),
          seleccion: g.seleccion,
          orden: gi,
        })
        .select("id_grupo")
        .single();
      if (gErr) throw new Error(gErr.message);
      const idGrupo = gIns!.id_grupo as string;

      // Deduplicar opciones por id_producto_opcion
      const seen = new Set<string>();
      const opcionesValidas = g.opciones.filter((o) => {
        if (seen.has(o.id_producto_opcion)) return false;
        seen.add(o.id_producto_opcion);
        return true;
      });

      if (opcionesValidas.length === 0) {
        throw new Error(`El grupo "${g.nombre}" debe tener al menos una opción`);
      }

      const rows = opcionesValidas.map((o, oi) => ({
        id_grupo: idGrupo,
        id_producto_opcion: o.id_producto_opcion,
        precio_delta: Number(o.precio_delta ?? 0),
        orden: oi,
      }));
      const { error: oInsErr } = await supabase
        .from("producto_variante_opciones")
        .insert(rows);
      if (oInsErr) throw new Error(oInsErr.message);
    }

    return { ok: true };
  });

// Lista productos del negocio (para usarlos como opciones de variante en el admin)
export const listarProductosParaVariantes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("productos")
      .select("id_producto, nombre_producto, precio_venta, activo")
      .order("nombre_producto");
    if (error) throw new Error(error.message);
    return (data ?? []).map((p) => ({
      id_producto: p.id_producto as string,
      nombre_producto: p.nombre_producto as string,
      precio_venta: Number(p.precio_venta ?? 0),
      activo: Boolean(p.activo),
    }));
  });
