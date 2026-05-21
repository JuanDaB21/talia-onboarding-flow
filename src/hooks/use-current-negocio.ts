import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useCurrentNegocio() {
  const [idNegocio, setIdNegocio] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        if (!cancelled) setLoading(false);
        return;
      }
      const { data } = await supabase
        .from("usuarios_staff")
        .select("id_negocio")
        .eq("id_usuario", userData.user.id)
        .maybeSingle();
      if (!cancelled) {
        setIdNegocio(data?.id_negocio ?? null);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { idNegocio, loading };
}
