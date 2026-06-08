import { useState } from "react";
import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Boxes,
  ShoppingCart,
  Warehouse,
  ChefHat,
  ChevronUp,
  LogOut,
  User as UserIcon,
  FolderTree,
  BookOpen,
  Package,
  Users,
  Utensils,
  ConciergeBell,
  Flame,
  Wine,
  Play,
  Square,
  LayoutDashboard,
  Activity,
  Wallet,
  Palette,
  QrCode,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useMiStaff, type Rol } from "@/hooks/use-mi-staff";
import { useAuthUser } from "@/hooks/use-auth-user";
import { iniciarTurno, finalizarTurno } from "@/lib/turno.functions";

const BODEGA_NAV = [
  { to: "/bodega/proveedores-insumos", label: "Proveedores e Insumos", icon: Boxes },
  { to: "/bodega/compras", label: "Compras", icon: ShoppingCart },
  { to: "/bodega/inventario", label: "Inventario", icon: Warehouse },
] as const;

const MENU_NAV = [
  { to: "/menu/categorias", label: "Categorías", icon: FolderTree },
  { to: "/menu/recetas", label: "Recetas", icon: BookOpen },
  { to: "/menu/productos", label: "Productos", icon: Package },
] as const;

const SERVICIO_NAV = [
  { to: "/servicio", label: "Mesas en servicio", icon: ConciergeBell },
] as const;

const COCINA_NAV = [{ to: "/cocina", label: "Cocina", icon: Flame }] as const;
const BARRA_NAV = [{ to: "/barra", label: "Barra", icon: Wine }] as const;

const CONFIG_NAV = [
  { to: "/configuracion/usuarios", label: "Usuarios", icon: Users },
  { to: "/configuracion/mesas", label: "Mesas", icon: Utensils },
  { to: "/configuracion/metodos-pago", label: "Métodos de pago", icon: QrCode },
  { to: "/configuracion/apariencia", label: "Menú público", icon: Palette },
] as const;

const ADMIN_NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/operacion", label: "Operación", icon: Activity },
  { to: "/caja", label: "Caja", icon: Wallet },
] as const;

function gruposPorRol(rol: Rol | null) {
  if (rol === "ADMIN" || rol === "SUPERADMIN") {
    return {
      admin: true,
      bodega: true,
      menu: true,
      servicio: true,
      cocina: true,
      barra: true,
      config: true,
    };
  }
  return {
    admin: false,
    bodega: false,
    menu: false,
    servicio: rol === "MESERO",
    cocina: rol === "COCINA",
    barra: rol === "BARRA",
    config: false,
  };
}

export function AppSidebar() {
  const { state, isMobile, setOpenMobile } = useSidebar();
  const collapsed = state === "collapsed";
  const closeIfMobile = () => {
    if (isMobile) setOpenMobile(false);
  };
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const { user } = useAuthUser();
  const email = user?.email ?? "";
  const { rol, enTurno, turnoIniciadoAt, invalidate } = useMiStaff();
  const iniciar = useServerFn(iniciarTurno);
  const finalizar = useServerFn(finalizarTurno);
  const [confirmCerrarOpen, setConfirmCerrarOpen] = useState(false);
  const [busy, setBusy] = useState(false);


  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  };

  const handleIniciar = async () => {
    setBusy(true);
    try {
      await iniciar();
      await invalidate();
      toast.success("Turno iniciado");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error";
      toast.error("No se pudo iniciar turno", { description: msg });
    } finally {
      setBusy(false);
    }
  };

  const handleFinalizar = async () => {
    setBusy(true);
    try {
      await finalizar();
      await invalidate();
      toast.success("Turno finalizado");
      setConfirmCerrarOpen(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error";
      toast.error("No se pudo finalizar turno", { description: msg });
    } finally {
      setBusy(false);
    }
  };

  const grupos = gruposPorRol(rol);
  const mostrarTurno = rol === "MESERO" || rol === "COCINA" || rol === "BARRA";

  const horaInicio = turnoIniciadoAt
    ? new Date(turnoIniciadoAt).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  const renderItem = (item: { to: string; label: string; icon: typeof Boxes }) => {
    const Icon = item.icon;
    const active = pathname.startsWith(item.to);
    return (
      <SidebarMenuItem key={item.to}>
        <SidebarMenuButton asChild isActive={active} tooltip={item.label}>
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          <Link to={item.to as any} onClick={closeIfMobile}>
            <Icon className="h-4 w-4" />
            <span>{item.label}</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  };
  const renderGroup = (
    label: string,
    items: ReadonlyArray<{ to: string; label: string; icon: typeof Boxes }>,
  ) => (
    <SidebarGroup>
      <SidebarGroupLabel>{label}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>{items.map(renderItem)}</SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <ChefHat className="h-4 w-4" />
          </div>
          {!collapsed && (
            <span className="text-base font-semibold tracking-tight">Talia</span>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        {grupos.admin && renderGroup("Administración", ADMIN_NAV)}
        {grupos.bodega && renderGroup("Bodega", BODEGA_NAV)}
        {grupos.menu && renderGroup("Menú", MENU_NAV)}
        {grupos.servicio && renderGroup("Servicio", SERVICIO_NAV)}
        {(grupos.cocina || grupos.barra) && (
          <SidebarGroup>
            <SidebarGroupLabel>Preparación</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {grupos.cocina &&
                  COCINA_NAV.map((item) => {
                    const Icon = item.icon;
                    const active = pathname.startsWith(item.to);
                    return (
                      <SidebarMenuItem key={item.to}>
                        <SidebarMenuButton asChild isActive={active} tooltip={item.label}>
                          <Link to={item.to} onClick={closeIfMobile}>
                            <Icon className="h-4 w-4" />
                            <span>{item.label}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                {grupos.barra &&
                  BARRA_NAV.map((item) => {
                    const Icon = item.icon;
                    const active = pathname.startsWith(item.to);
                    return (
                      <SidebarMenuItem key={item.to}>
                        <SidebarMenuButton asChild isActive={active} tooltip={item.label}>
                          <Link to={item.to} onClick={closeIfMobile}>
                            <Icon className="h-4 w-4" />
                            <span>{item.label}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
        {grupos.config && renderGroup("Configuración", CONFIG_NAV)}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          {mostrarTurno && (
            <SidebarMenuItem>
              {enTurno ? (
                <SidebarMenuButton
                  onClick={() => setConfirmCerrarOpen(true)}
                  tooltip={`Finalizar turno${horaInicio ? ` (desde ${horaInicio})` : ""}`}
                  className="bg-destructive/10 text-destructive hover:bg-destructive/20"
                >
                  <Square className="h-4 w-4" />
                  <span>
                    Finalizar turno
                    {horaInicio && (
                      <span className="ml-1 text-xs opacity-70">· {horaInicio}</span>
                    )}
                  </span>
                </SidebarMenuButton>
              ) : (
                <SidebarMenuButton
                  onClick={handleIniciar}
                  disabled={busy}
                  tooltip="Iniciar turno"
                  className="bg-primary/10 text-primary hover:bg-primary/20"
                >
                  <Play className="h-4 w-4" />
                  <span>Iniciar turno</span>
                </SidebarMenuButton>
              )}
            </SidebarMenuItem>
          )}
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent"
                  tooltip={email || "Mi perfil"}
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                    <UserIcon className="h-4 w-4" />
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col text-left text-xs">
                    <span className="font-medium">Mi perfil</span>
                    <span className="truncate text-muted-foreground">
                      {email || "—"}
                    </span>
                  </div>
                  <ChevronUp className="ml-auto h-4 w-4" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="end" className="w-56">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col">
                    <span className="text-xs text-muted-foreground">
                      Sesión iniciada como
                    </span>
                    <span className="truncate text-sm font-medium">
                      {email || "—"}
                    </span>
                    {rol && (
                      <span className="text-xs text-muted-foreground">Rol: {rol}</span>
                    )}
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Cerrar sesión
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <AlertDialog open={confirmCerrarOpen} onOpenChange={setConfirmCerrarOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Finalizar turno?</AlertDialogTitle>
            <AlertDialogDescription>
              {rol === "MESERO"
                ? "Si tienes mesas con cuenta abierta no podrás salir. Tras finalizar, dejarás de recibir asignaciones."
                : "Tras finalizar, dejarás de recibir nuevos pedidos en tu estación."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleFinalizar} disabled={busy}>
              Finalizar turno
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sidebar>
  );
}
