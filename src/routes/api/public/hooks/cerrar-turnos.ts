import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/cerrar-turnos")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env.SUPABASE_PUBLISHABLE_KEY;
        const apikey = request.headers.get("apikey");
        if (!expected || apikey !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }

        const { supabaseAdmin } = await import(
          "@/integrations/supabase/client.server"
        );
        const [cerrar, purga] = await Promise.all([
          supabaseAdmin.rpc("cerrar_turnos_vencidos"),
          supabaseAdmin.rpc("purgar_prepedido_inactivo"),
        ]);
        if (cerrar.error) {
          return Response.json({ ok: false, error: cerrar.error.message }, { status: 500 });
        }
        if (purga.error) {
          return Response.json({ ok: false, error: purga.error.message }, { status: 500 });
        }
        return Response.json({
          ok: true,
          cerrados: cerrar.data ?? 0,
          prepedidos_purgados: purga.data ?? 0,
        });
      },
    },
  },
});
