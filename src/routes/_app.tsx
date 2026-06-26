import { useEffect } from "react";
import {
  createFileRoute,
  Outlet,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { useMiStaff } from "@/hooks/use-mi-staff";
import { useAuthUser } from "@/hooks/use-auth-user";
import { FloatingChatButton } from "@/components/chat/floating-chat-button";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function AppLayout() {
  const navigate = useNavigate();
  const { user, loading } = useAuthUser();

  useEffect(() => {
    if (!loading && !user) {
      navigate({ to: "/login" });
    }
  }, [loading, user, navigate]);

  if (loading || !user) {
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
        <FloatingChatButton />
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
      CAJERO: {
        home: "/caja",
        allowed: [
          "/caja",
          "/operacion",
          "/servicio",
          "/reservas",
          "/cocina",
          "/barra",
          "/bodega/compras",
          "/bodega/inventario",
        ],
      },
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
