// Variantes de receta (grupos + opciones sobre insumos) vía REST del backend Talia
// (/variantes/*). Reemplaza el acceso a datos inline anterior. Los insumos usados como
// opciones se leen de /bodega/insumos.
import { api } from "@/lib/api-client";
import type { GuardarVariantesInput } from "@/lib/menu-schemas";

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

export function listarVariantesReceta(input: { idReceta: string }): Promise<VarianteGrupo[]> {
  return api.get<VarianteGrupo[]>(`/variantes/recetas/${input.idReceta}`);
}

// Grupo de variantes reutilizable: un VarianteGrupo con la receta origen como contexto.
export interface VariantePlantilla extends VarianteGrupo {
  id_receta: string;
  nombre_receta: string;
}

// Lista los grupos de variantes de todas las recetas del negocio, para reutilizarlos.
// `excluir` omite los grupos de una receta (típicamente la que se está editando).
export function listarPlantillasVariantes(input?: {
  excluir?: string;
}): Promise<VariantePlantilla[]> {
  const qs = input?.excluir ? `?excluir=${encodeURIComponent(input.excluir)}` : "";
  return api.get<VariantePlantilla[]>(`/variantes/plantillas${qs}`);
}

// El backend reemplaza todos los grupos de la receta (borrar + reinsertar). Solo envía
// grupos/opciones; los campos orden/id se derivan/ignoran en el servidor.
export function guardarVariantesReceta(input: GuardarVariantesInput): Promise<{ ok: true }> {
  return api.put<{ ok: true }>(`/variantes/recetas/${input.idReceta}`, { grupos: input.grupos });
}

export interface InsumoParaVariante {
  id_insumo: string;
  nombre_insumo: string;
  unidad_receta: string;
}

// Lista insumos del negocio (para usarlos como opciones de variante en el admin).
export function listarInsumosParaVariantes(): Promise<InsumoParaVariante[]> {
  return api
    .get<Array<{ id_insumo: string; nombre_insumo: string; unidad_receta: string | null }>>(
      "/bodega/insumos",
    )
    .then((rows) =>
      rows.map((i) => ({
        id_insumo: i.id_insumo,
        nombre_insumo: i.nombre_insumo,
        unidad_receta: i.unidad_receta ?? "",
      })),
    );
}
