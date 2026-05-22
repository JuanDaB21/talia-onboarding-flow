import { createFileRoute, Outlet, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Boxes, ShoppingCart, Warehouse, Menu } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

export const Route = createFileRoute("/bodega")({
  head: () => ({
    meta: [{ title: "Bodega — Talia" }],
  }),
  component: BodegaLayout,
});

const NAV = [
  { to: "/bodega/proveedores-insumos", label: "Proveedores e Insumos", icon: Boxes },
  { to: "/bodega/compras", label: "Compras", icon: ShoppingCart },
  { to: "/bodega/inventario", label: "Inventario", icon: Warehouse },
] as const;

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="flex flex-col gap-1">
      {NAV.map((item) => {
        const active = pathname.startsWith(item.to);
        const Icon = item.icon;
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
              active
                ? "bg-primary text-primary-foreground"
                : "text-foreground hover:bg-muted"
            )}
          >
            <Icon className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function BodegaLayout() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);

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
    <div className="min-h-screen bg-muted/30">
      {/* Header móvil */}
      <header className="md:hidden flex items-center gap-2 border-b bg-background px-4 py-3 sticky top-0 z-30">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon" aria-label="Abrir menú">
              <Menu className="h-4 w-4" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-4">
            <h2 className="text-base font-semibold mb-3">Bodega</h2>
            <NavLinks onNavigate={() => setMobileOpen(false)} />
          </SheetContent>
        </Sheet>
        <h1 className="text-base font-semibold">Bodega</h1>
      </header>

      <div className="flex">
        {/* Sidebar desktop */}
        <aside className="hidden md:flex md:flex-col w-64 shrink-0 border-r bg-background min-h-screen p-4 sticky top-0">
          <div className="mb-4">
            <h2 className="text-lg font-semibold">Bodega</h2>
          </div>
          <NavLinks />
        </aside>

        <main className="flex-1 px-4 py-6 md:px-8 md:py-8 min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
