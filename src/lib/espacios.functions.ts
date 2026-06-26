import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface EspacioTrabajo {
  id_espacio: string;
  nombre: string;
  slug: string;
  activo: boolean;
  es_sistema: boolean;
  orden: number;
}

function slugify(nombre: string): string {
  return nombre
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

export const listarEspacios = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("espacios_trabajo")
      .select("id_espacio, nombre, slug, activo, es_sistema, orden")
      .order("orden", { ascending: true })
      .order("nombre", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as EspacioTrabajo[];
  });

export const crearEspacio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ nombre: z.string().trim().min(2).max(40) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: neg } = await supabase
      .from("negocio")
      .select("id_negocio")
      .maybeSingle();
    if (!neg) throw new Error("Negocio no encontrado");

    const slug = slugify(data.nombre);
    if (!slug) throw new Error("Nombre inválido");

    const { data: maxRow } = await supabase
      .from("espacios_trabajo")
      .select("orden")
      .order("orden", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextOrden = (maxRow?.orden ?? -1) + 1;

    const { error } = await supabase.from("espacios_trabajo").insert({
      id_negocio: neg.id_negocio,
      nombre: data.nombre.trim(),
      slug,
      activo: true,
      es_sistema: false,
      orden: nextOrden,
    });
    if (error) {
      if (error.code === "23505") throw new Error("Ya existe un espacio con ese nombre");
      throw new Error(error.message);
    }
    return { ok: true };
  });

export const renombrarEspacio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        id_espacio: z.string().uuid(),
        nombre: z.string().trim().min(2).max(40),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("espacios_trabajo")
      .update({ nombre: data.nombre.trim() })
      .eq("id_espacio", data.id_espacio);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const toggleEspacio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({ id_espacio: z.string().uuid(), activo: z.boolean() })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("espacios_trabajo")
      .update({ activo: data.activo })
      .eq("id_espacio", data.id_espacio);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const eliminarEspacio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ id_espacio: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    // Validar que no tenga categorías asignadas
    const { data: esp } = await supabase
      .from("espacios_trabajo")
      .select("slug, es_sistema")
      .eq("id_espacio", data.id_espacio)
      .maybeSingle();
    if (!esp) throw new Error("Espacio no encontrado");
    if (esp.es_sistema) throw new Error("No se puede eliminar un espacio del sistema");
    const { count } = await supabase
      .from("categorias")
      .select("id_categoria", { count: "exact", head: true })
      .eq("destino", esp.slug);
    if ((count ?? 0) > 0) {
      throw new Error("Hay categorías asociadas. Reasígnalas o desactiva el espacio.");
    }
    const { error } = await supabase
      .from("espacios_trabajo")
      .delete()
      .eq("id_espacio", data.id_espacio);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
