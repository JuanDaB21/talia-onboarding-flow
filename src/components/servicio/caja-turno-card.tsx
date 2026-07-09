import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Clock, Coffee, LogIn, UserCheck, UserX } from "lucide-react";
import { toast } from "sonner";
import { getMiStaff } from "@/lib/turno.functions";
import { ausentarmeMesero, inhabilitarStaff, retornarMesero } from "@/lib/usuarios.functions";
import { logout } from "@/lib/auth";
import { setAuthUser } from "@/hooks/use-auth-user";
import { Button } from "@/components/ui/button";
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
import { POLL } from "@/lib/query-config";

function formatDuracion(ms: number) {
  if (ms < 0) ms = 0;
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m} min`;
  return `${h}h ${m.toString().padStart(2, "0")}m`;
}

export function CajaTurnoCard() {
  const navigate = useNavigate();
  const { data, refetch } = useQuery({
    queryKey: ["mi-staff", "turno-card"],
    queryFn: () => getMiStaff(),
    ...POLL.SLOW,
  });

  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ausentando, setAusentando] = useState(false);

  if (!data || !data.esta_en_turno || !data.turno_iniciado_at) return null;

  const esMesero = data.rol === "MESERO";
  const ausente = !!data.ausente_desde;

  const handleAusentarme = async () => {
    setAusentando(true);
    try {
      const { reasignadas } = await ausentarmeMesero();
      toast.success("Estás ausente", {
        description:
          reasignadas > 0
            ? `${reasignadas} mesa(s) se repartieron entre los meseros en turno.`
            : "No tenías mesas asignadas.",
      });
      await refetch();
    } catch (e) {
      toast.error("No se pudo marcar ausente", {
        description: e instanceof Error ? e.message : "",
      });
    } finally {
      setAusentando(false);
    }
  };

  const handleVolver = async () => {
    setAusentando(true);
    try {
      const { devueltas } = await retornarMesero();
      toast.success("¡Bienvenido de vuelta!", {
        description:
          devueltas > 0
            ? `Se te devolvieron ${devueltas} mesa(s) que seguían abiertas.`
            : "No había mesas abiertas para devolverte.",
      });
      await refetch();
    } catch (e) {
      toast.error("No se pudo retornar", {
        description: e instanceof Error ? e.message : "",
      });
    } finally {
      setAusentando(false);
    }
  };

  const inicio = new Date(data.turno_iniciado_at);
  const ahora = Date.now();
  const trabajado = ahora - inicio.getTime();
  const horaIngreso = inicio.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  const handleInhabilitar = async () => {
    setBusy(true);
    try {
      await inhabilitarStaff();
      toast.success("Tu cuenta fue inhabilitada");
      await logout();
      setAuthUser(null);
      navigate({ to: "/login" });
    } catch (e) {
      toast.error("No se pudo inhabilitar", {
        description: e instanceof Error ? e.message : "",
      });
    } finally {
      setBusy(false);
      setOpen(false);
    }
  };

  return (
    <section className="rounded-xl border bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Mi turno
        </h2>
        {ausente ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-300">
            <Coffee className="h-3.5 w-3.5" />
            Ausente
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            En turno
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Stat
          icon={<LogIn className="h-4 w-4" />}
          label="Hora de ingreso"
          value={horaIngreso}
        />
        <Stat
          icon={<Clock className="h-4 w-4" />}
          label="Tiempo trabajado"
          value={formatDuracion(trabajado)}
        />
      </div>

      {ausente && (
        <p className="mt-3 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
          Estás ausente: tus mesas se repartieron entre los meseros en turno. Al
          volver, las que sigan abiertas se te devolverán.
        </p>
      )}

      <div className="mt-3 flex flex-wrap justify-end gap-2">
        {esMesero &&
          (ausente ? (
            <Button size="sm" disabled={ausentando} onClick={handleVolver}>
              <UserCheck className="mr-1 h-4 w-4" />
              {ausentando ? "Volviendo…" : "Volver"}
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              disabled={ausentando}
              onClick={handleAusentarme}
            >
              <Coffee className="mr-1 h-4 w-4" />
              {ausentando ? "Saliendo…" : "Ausentarme"}
            </Button>
          ))}
        <Button
          variant="outline"
          size="sm"
          className="text-destructive hover:text-destructive"
          onClick={() => setOpen(true)}
        >
          <UserX className="mr-1 h-4 w-4" />
          Inhabilitarme
        </Button>
      </div>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Inhabilitar tu cuenta?</AlertDialogTitle>
            <AlertDialogDescription>
              Tu cuenta quedará INACTIVA y se cerrará tu sesión. Un
              administrador deberá reactivarla para volver a ingresar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={(e) => {
                e.preventDefault();
                handleInhabilitar();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {busy ? "Inhabilitando…" : "Inhabilitarme"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border p-2">
      <div className="flex items-center gap-1 text-[11px] text-muted-foreground uppercase tracking-wider">
        {icon}
        {label}
      </div>
      <p className="mt-1 font-bold tabular-nums text-sm">{value}</p>
    </div>
  );
}
