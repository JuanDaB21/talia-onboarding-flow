import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const PLATAFORMAS = ["Nequi", "Daviplata", "Bancolombia", "Otra"] as const;
export type Plataforma = (typeof PLATAFORMAS)[number];

export interface MetodoPagoQr {
  id_qr: string;
  plataforma: Plataforma;
  etiqueta: string | null;
  titular: string | null;
  url_qr: string; // path
  signed_url: string | null;
}

export const listarMetodosPagoQr = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MetodoPagoQr[]> => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("metodos_pago_qr")
      .select("id_qr, plataforma, etiqueta, titular, url_qr")
      .order("plataforma", { ascending: true })
      .order("etiqueta", { ascending: true, nullsFirst: true });
    if (error) throw new Error(error.message);

    const out: MetodoPagoQr[] = await Promise.all(
      (data ?? []).map(async (r) => {
        let signed: string | null = null;
        if (r.url_qr) {
          const { data: s } = await supabase.storage
            .from("qr-metodos-pago")
            .createSignedUrl(r.url_qr, 60 * 30);
          signed = s?.signedUrl ?? null;
        }
        return {
          id_qr: r.id_qr,
          plataforma: r.plataforma as Plataforma,
          etiqueta: (r.etiqueta as string | null) ?? null,
          titular: (r.titular as string | null) ?? null,
          url_qr: r.url_qr,
          signed_url: signed,
        };
      }),
    );
    return out;
  });

const guardarSchema = z.object({
  idQr: z.string().uuid().optional(),
  plataforma: z.enum(PLATAFORMAS),
  etiqueta: z.string().trim().max(40).optional().nullable(),
  titular: z.string().trim().max(80).optional().nullable(),
  path: z.string().min(1).max(500),
});

export const guardarMetodoPagoQr = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => guardarSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: neg } = await supabase
      .from("negocio")
      .select("id_negocio")
      .maybeSingle();
    if (!neg) throw new Error("Negocio no encontrado");

    const etiqueta =
      data.plataforma === "Otra"
        ? (data.etiqueta ?? "").trim() || null
        : null;

    if (data.idQr) {
      const { error } = await supabase
        .from("metodos_pago_qr")
        .update({
          plataforma: data.plataforma,
          etiqueta,
          titular: data.titular?.trim() || null,
          url_qr: data.path,
        })
        .eq("id_qr", data.idQr);
      if (error) throw new Error(error.message);
      return { idQr: data.idQr };
    }

    const { data: ins, error } = await supabase
      .from("metodos_pago_qr")
      .insert({
        id_negocio: neg.id_negocio,
        plataforma: data.plataforma,
        etiqueta,
        titular: data.titular?.trim() || null,
        url_qr: data.path,
      })
      .select("id_qr")
      .single();
    if (error) throw new Error(error.message);
    return { idQr: ins.id_qr };
  });

export const eliminarMetodoPagoQr = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ idQr: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: row } = await supabase
      .from("metodos_pago_qr")
      .select("url_qr")
      .eq("id_qr", data.idQr)
      .maybeSingle();
    const { error } = await supabase
      .from("metodos_pago_qr")
      .delete()
      .eq("id_qr", data.idQr);
    if (error) throw new Error(error.message);
    if (row?.url_qr) {
      await supabase.storage.from("qr-metodos-pago").remove([row.url_qr]);
    }
    return { ok: true };
  });
