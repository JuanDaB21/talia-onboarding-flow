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
  const { rol, loading, staff } = useMiStaff();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (loading || !rol) return;
    if (rol === "ADMIN" || rol === "SUPERADMIN") return;

    if (rol === "MESERO") {
      if (!pathname.startsWith("/servicio")) navigate({ to: "/servicio" });
      return;
    }
    if (rol === "COCINA" || rol === "BARRA" || rol === "ESTACION") {
      const slug =
        staff?.espacio_slug ??
        (rol === "COCINA" ? "COCINA" : rol === "BARRA" ? "BARRA" : null);
      const home = slug ? `/estacion/${slug}` : "/";
      if (!pathname.startsWith(home) && !pathname.startsWith("/estacion/")) {
        navigate({ to: home });
      }
      return;
    }
    if (rol === "CAJERO") {
      const allowed = [
        "/caja",
        "/operacion",
        "/servicio",
        "/reservas",
        "/estacion",
        "/cocina",
        "/barra",
        "/bodega/compras",
        "/bodega/inventario",
      ];
      const permitido = allowed.some((p) => pathname.startsWith(p));
      if (!permitido) navigate({ to: "/caja" });
    }
  }, [rol, loading, pathname, navigate, staff?.espacio_slug]);

  return null;
}
