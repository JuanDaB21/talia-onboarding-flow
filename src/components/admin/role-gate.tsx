import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { useMiStaff, type Rol } from "@/hooks/use-mi-staff";

interface Props {
  roles: ReadonlyArray<Rol>;
  children: React.ReactNode;
}

export function RoleGate({ roles, children }: Props) {
  const { rol, loading } = useMiStaff();
  const navigate = useNavigate();
  const ok = !!rol && roles.includes(rol);

  useEffect(() => {
    if (!loading && rol && !ok) {
      toast.error("Sin acceso a este módulo");
      navigate({ to: "/" });
    }
  }, [loading, rol, ok, navigate]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-sm text-muted-foreground">Cargando…</p>
      </div>
    );
  }
  if (!ok) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-2 text-center">
        <ShieldAlert className="h-10 w-10 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Sin acceso</p>
      </div>
    );
  }
  return <>{children}</>;
}
