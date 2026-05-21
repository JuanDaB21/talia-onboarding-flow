import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Warehouse } from "lucide-react";

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
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Link
            to="/bodega"
            className="flex items-start gap-3 rounded-lg border bg-card p-4 hover:bg-muted transition-colors"
          >
            <Warehouse className="h-5 w-5 mt-0.5" />
            <div>
              <p className="font-medium">Bodega</p>
              <p className="text-xs text-muted-foreground">
                Proveedores, insumos, compras e inventario.
              </p>
            </div>
          </Link>
        </div>
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
