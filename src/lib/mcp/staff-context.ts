import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { ToolContext } from "@lovable.dev/mcp-js";
import type { Database } from "@/integrations/supabase/types";

export type StaffContext = {
  supabase: SupabaseClient<Database>;
  idNegocio: string;
  rol: string;
  userId: string;
};

/**
 * Builds a Supabase client scoped to the authenticated user (RLS applies as
 * that user) and resolves their staff row + business. Returns null when the
 * caller is not authenticated or not registered as staff of any business.
 */
export async function getStaffContext(
  ctx: ToolContext,
): Promise<StaffContext | null> {
  if (!ctx.isAuthenticated()) return null;
  const url = process.env.SUPABASE_URL;
  const anon = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !anon) return null;

  const token = ctx.getToken();
  const supabase = createClient<Database>(url, anon, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const userId = ctx.getUserId();
  if (!userId) return null;

  const { data: staff } = await supabase
    .from("usuarios_staff")
    .select("id_negocio, rol")
    .eq("id_usuario", userId)
    .maybeSingle();

  if (!staff?.id_negocio) return null;
  return { supabase, idNegocio: staff.id_negocio, rol: staff.rol, userId };
}

export function notAuthenticatedResult() {
  return {
    content: [
      {
        type: "text" as const,
        text: "No estás autenticado o tu usuario no está asociado a ningún negocio de Talia.",
      },
    ],
    isError: true,
  };
}

export function jsonResult(value: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }],
    structuredContent: value as Record<string, unknown>,
  };
}
