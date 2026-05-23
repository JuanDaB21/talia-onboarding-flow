import { useEffect, useState } from "react";
import {
  createFileRoute,
  Outlet,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { useMiStaff } from "@/hooks/use-mi-staff";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function AppLayout() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        navigate({ to: "/login" });
        return;
      }
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
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-muted/30">
        <AppSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-12 items-center gap-2 border-b bg-background px-3">
            <SidebarTrigger />
          </header>
          <main className="min-w-0 flex-1 px-4 py-6 md:px-8 md:py-8">
            <RoleRedirect />
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function RoleRedirect() {
  const { rol, loading } = useMiStaff();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (loading || !rol) return;
    const rules: Record<string, { home: string; allowed: string[] }> = {
      MESERO: { home: "/servicio", allowed: ["/servicio"] },
      COCINA: { home: "/cocina", allowed: ["/cocina"] },
      BARRA: { home: "/barra", allowed: ["/barra"] },
    };
    const cfg = rules[rol];
    if (!cfg) return; // ADMIN/SUPERADMIN sin restricción
    const permitido = cfg.allowed.some((p) => pathname.startsWith(p));
    if (!permitido) {
      navigate({ to: cfg.home });
    }
  }, [rol, loading, pathname, navigate]);

  return null;
}
