import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { guardarVariantesSchema } from "@/lib/menu-schemas";

export interface VarianteOpcion {
  id_opcion: string;
  id_insumo_opcion: string;
  nombre_insumo_opcion: string;
  unidad_receta: string;
  cantidad_porcion: number;
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

const idRecetaSchema = z.object({ idReceta: z.string().uuid() });

export const listarVariantesReceta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => idRecetaSchema.parse(input))
  .handler(async ({ data, context }): Promise<VarianteGrupo[]> => {
    const { supabase } = context;
    const { data: grupos, error } = await supabase
      .from("producto_variante_grupos")
      .select("id_grupo, nombre, seleccion, orden")
      .eq("id_receta", data.idReceta)
      .order("orden", { ascending: true });
    if (error) throw new Error(error.message);

    const gs = (grupos ?? []) as Array<{
      id_grupo: string;
      nombre: string;
      seleccion: "UNICA" | "MULTIPLE";
      orden: number;
    }>;
    if (gs.length === 0) return [];
    const ids = gs.map((g) => g.id_grupo);

    const { data: opciones, error: oErr } = await supabase
      .from("producto_variante_opciones")
      .select(
        "id_opcion, id_grupo, id_insumo_opcion, cantidad_porcion, precio_delta, orden, insumos:id_insumo_opcion(nombre_insumo, unidad_receta)",
      )
      .in("id_grupo", ids);
    if (oErr) throw new Error(oErr.message);

    const byGrupo = new Map<string, VarianteOpcion[]>();
    for (const raw of (opciones ?? []) as unknown as Array<Record<string, unknown>>) {
      const idg = raw.id_grupo as string;
      const arr = byGrupo.get(idg) ?? [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ins = (raw as any).insumos as { nombre_insumo?: string; unidad_receta?: string } | null;
      arr.push({
        id_opcion: raw.id_opcion as string,
        id_insumo_opcion: raw.id_insumo_opcion as string,
        nombre_insumo_opcion: ins?.nombre_insumo ?? "—",
        unidad_receta: ins?.unidad_receta ?? "",
        cantidad_porcion: Number(raw.cantidad_porcion ?? 0),
        precio_delta: Number(raw.precio_delta ?? 0),
        orden: Number(raw.orden ?? 0),
      });
      byGrupo.set(idg, arr);
    }
    byGrupo.forEach((arr) =>
      arr.sort(
        (a, b) => a.orden - b.orden || a.nombre_insumo_opcion.localeCompare(b.nombre_insumo_opcion),
      ),
    );

    return gs.map((g) => ({
      id_grupo: g.id_grupo,
      nombre: g.nombre,
      seleccion: g.seleccion,
      orden: Number(g.orden ?? 0),
      opciones: byGrupo.get(g.id_grupo) ?? [],
    }));
  });

export const guardarVariantesReceta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => guardarVariantesSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    // RLS asegura que la receta pertenezca al negocio
    const { data: rec, error: rErr } = await supabase
      .from("receta_master")
      .select("id_receta")
      .eq("id_receta", data.idReceta)
      .maybeSingle();
    if (rErr) throw new Error(rErr.message);
    if (!rec) throw new Error("Receta no encontrada");

    // Borrar todos los grupos de la receta y reinsertar
    const { error: dErr } = await supabase
      .from("producto_variante_grupos")
      .delete()
      .eq("id_receta", data.idReceta);
    if (dErr) throw new Error(dErr.message);

    for (let gi = 0; gi < data.grupos.length; gi++) {
      const g = data.grupos[gi];
      const { data: gIns, error: gErr } = await supabase
        .from("producto_variante_grupos")
        .insert({
          id_receta: data.idReceta,
          nombre: g.nombre.trim(),
          seleccion: g.seleccion,
          orden: gi,
        })
        .select("id_grupo")
        .single();
      if (gErr) throw new Error(gErr.message);
      const idGrupo = gIns!.id_grupo as string;

      // Deduplicar opciones por id_insumo_opcion
      const seen = new Set<string>();
      const opcionesValidas = g.opciones.filter((o) => {
        if (seen.has(o.id_insumo_opcion)) return false;
        seen.add(o.id_insumo_opcion);
        return true;
      });

      if (opcionesValidas.length === 0) {
        throw new Error(`El grupo "${g.nombre}" debe tener al menos una opción`);
      }

      const rows = opcionesValidas.map((o, oi) => ({
        id_grupo: idGrupo,
        id_insumo_opcion: o.id_insumo_opcion,
        cantidad_porcion: Number(o.cantidad_porcion),
        precio_delta: Number(o.precio_delta ?? 0),
        orden: oi,
      }));
      const { error: oInsErr } = await supabase.from("producto_variante_opciones").insert(rows);
      if (oInsErr) throw new Error(oInsErr.message);
    }

    return { ok: true };
  });

// Lista insumos del negocio (para usarlos como opciones de variante en el admin)
export const listarInsumosParaVariantes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("insumos")
      .select("id_insumo, nombre_insumo, unidad_receta")
      .order("nombre_insumo");
    if (error) throw new Error(error.message);
    return (data ?? []).map((i) => ({
      id_insumo: i.id_insumo as string,
      nombre_insumo: i.nombre_insumo as string,
      unidad_receta: i.unidad_receta as string,
    }));
  });
