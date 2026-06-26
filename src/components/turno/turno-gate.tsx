import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Play, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMiStaff, type Rol } from "@/hooks/use-mi-staff";
import { iniciarTurno } from "@/lib/turno.functions";

interface Props {
  rolesRequeridos: Array<Exclude<Rol, "SUPERADMIN" | "ADMIN" | null>>;
  /** Si se pasa, exige que el usuario tenga ese espacio asignado (admins exentos). */
  espacioSlug?: string;
  children: React.ReactNode;
}

export function TurnoGate({ rolesRequeridos, espacioSlug, children }: Props) {
  const { rol, enTurno, loading, invalidate, staff } = useMiStaff();
  const navigate = useNavigate();
  const iniciar = useServerFn(iniciarTurno);

  const esAdmin = rol === "ADMIN" || rol === "SUPERADMIN";
  const rolPermitido =
    esAdmin || (rol && rolesRequeridos.includes(rol as never));
  const espacioOk =
    !espacioSlug ||
    esAdmin ||
    (staff?.espacio_slug ?? "").toUpperCase() === espacioSlug.toUpperCase() ||
    // Compat: roles legados COCINA/BARRA sin id_espacio_asignado
    (rol === "COCINA" && espacioSlug.toUpperCase() === "COCINA") ||
    (rol === "BARRA" && espacioSlug.toUpperCase() === "BARRA");
  const accesoPermitido = Boolean(rolPermitido && espacioOk);

  useEffect(() => {
    if (!loading && rol && !accesoPermitido) {
      toast.error("Sin acceso a este módulo");
      navigate({ to: "/" });
    }
  }, [loading, rol, accesoPermitido, navigate]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-sm text-muted-foreground">Cargando…</p>
      </div>
    );
  }

  if (!accesoPermitido) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-2 text-center">
        <ShieldAlert className="h-10 w-10 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Sin acceso</p>
      </div>
    );
  }

  // ADMIN/SUPERADMIN no requieren turno
  if (esAdmin) {
    return <>{children}</>;
  }

  if (!enTurno) {
    const handleIniciar = async () => {
      try {
        await iniciar();
        await invalidate();
        toast.success("Turno iniciado");
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Error";
        toast.error("No se pudo iniciar turno", { description: msg });
      }
    };
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center gap-6 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
          <Play className="h-10 w-10 text-primary" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">Inicia tu turno</h1>
          <p className="text-sm text-muted-foreground">
            Para acceder a este módulo necesitas estar en turno activo.
          </p>
        </div>
        <Button size="lg" onClick={handleIniciar} className="w-full">
          <Play className="mr-2 h-4 w-4" /> Iniciar turno
        </Button>
      </div>
    );
  }

  return <>{children}</>;
}
