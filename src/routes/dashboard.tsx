import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [{ title: "Panel — Talia" }],
  }),
  component: DashboardStub,
});

function DashboardStub() {
  const navigate = useNavigate();
  const [email, setEmail] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        navigate({ to: "/login" });
        return;
      }
      setEmail(data.user.email ?? null);
      setChecking(false);
    });
  }, [navigate]);

  if (checking) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">Cargando…</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-muted/30 px-4 py-8">
      <div className="mx-auto max-w-2xl space-y-4">
        <h1 className="text-2xl font-bold">Panel SUPERADMIN</h1>
        <p className="text-sm text-muted-foreground">
          Sesión iniciada como <span className="font-medium">{email}</span>.
          Próximamente: gestión de menú, mesas, pedidos y staff.
        </p>
        <Button
          variant="outline"
          onClick={async () => {
            await supabase.auth.signOut();
            navigate({ to: "/login" });
          }}
        >
          Cerrar sesión
        </Button>
      </div>
    </main>
  );
}
