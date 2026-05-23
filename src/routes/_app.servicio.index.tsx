import { useEffect } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Bell, ChefHat, Clock, UserCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { listarMesasServicio, type MesaServicio } from "@/lib/servicio.functions";

export const Route = createFileRoute("/_app/servicio/")({
  head: () => ({ meta: [{ title: "Servicio — Mesas" }] }),
  component: ServicioIndex,
});

function ServicioIndex() {
  const listar = useServerFn(listarMesasServicio);
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["servicio", "mesas"],
    queryFn: () => listar(),
    refetchInterval: 15000,
  });

  useEffect(() => {
    if (!data?.userId) return;
    const myId = data.userId;
    const ch = supabase
      .channel("servicio-mesas")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "mesas" },
        (payload) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const nuevo: any = payload.new;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const viejo: any = payload.old;
          const meAsignaron =
            nuevo?.id_mesero_asignado === myId &&
            viejo?.id_mesero_asignado !== myId;
          if (meAsignaron) {
            toast.info(`Mesa ${nuevo.identificador} te necesita`, {
              description: "Te asignaron una nueva mesa.",
              icon: <Bell className="h-4 w-4" />,
            });
          }
          refetch();
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [data?.userId, refetch]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Mesas en servicio</h1>
        <p className="text-sm text-muted-foreground">
          {data?.esAdmin
            ? "Vista de todas las mesas del local."
            : "Mesas asignadas a ti."}
        </p>
      </header>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : !data || data.mesas.length === 0 ? (
        <div className="rounded-lg border bg-card p-12 text-center">
          <ChefHat className="mx-auto h-10 w-10 text-muted-foreground/50" />
          <p className="mt-3 text-sm text-muted-foreground">
            No tienes mesas activas en este momento.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.mesas.map((m) => (
            <MesaCard key={m.id_mesa} m={m} />
          ))}
        </div>
      )}
    </div>
  );
}

function MesaCard({ m }: { m: MesaServicio }) {
  const ocupada = m.estado === "OCUPADA";
  return (
    <Link
      to="/servicio/$idMesa"
      params={{ idMesa: m.id_mesa }}
      className="block rounded-xl border bg-card p-4 hover:shadow-md transition-shadow"
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            Mesa
          </p>
          <h3 className="text-xl font-bold">{m.identificador}</h3>
        </div>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
            ocupada
              ? "bg-primary/15 text-primary"
              : "bg-muted text-muted-foreground"
          }`}
        >
          {m.estado}
        </span>
      </div>
      <div className="mt-3 space-y-1 text-xs text-muted-foreground">
        {m.mesero_nombre && (
          <div className="flex items-center gap-1.5">
            <UserCheck className="h-3.5 w-3.5" />
            <span>{m.mesero_nombre}</span>
          </div>
        )}
        {m.asignada_at && (
          <div className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            <span>
              Asignada {new Date(m.asignada_at).toLocaleTimeString()}
            </span>
          </div>
        )}
      </div>
    </Link>
  );
}
