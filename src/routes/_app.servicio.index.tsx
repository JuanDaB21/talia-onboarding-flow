import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Bell, ChefHat, Clock, CreditCard, Plus, Radio, UserCheck, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { listarMesasServicio, type MesaServicio } from "@/lib/servicio.functions";
import { listarPagosPendientes } from "@/lib/pagos.functions";
import { beepListo } from "@/components/servicio/alerta-sound";
import { CajaTurnoCard } from "@/components/servicio/caja-turno-card";
import { PagosPendientesSheet } from "@/components/servicio/pagos-pendientes-sheet";


export const Route = createFileRoute("/_app/servicio/")({
  head: () => ({ meta: [{ title: "Servicio — Mesas" }] }),
  component: ServicioIndex,
});

function ServicioIndex() {
  const listar = useServerFn(listarMesasServicio);
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["servicio", "mesas"],
    queryFn: () => listar(),
    // Sin polling: el canal realtime de abajo invalida cualquier cambio.
    staleTime: 60_000,
  });

  // Realtime: cualquier cambio relevante refresca
  useEffect(() => {
    if (!data?.userId) return;
    const myId = data.userId;
    const ch = supabase
      .channel("servicio-mesas-global")
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
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "pedido_items" },
        () => refetch(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pedidos" },
        () => refetch(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "prepedido_items" },
        () => refetch(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [data?.userId, refetch]);

  // Detectar mesas que pasan a tener alerta LISTO y avisar
  const prevListoRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!data?.mesas) return;
    const ahora = new Set<string>();
    for (const m of data.mesas) {
      if (m.alerta_listo) ahora.add(m.id_mesa);
    }
    for (const id of ahora) {
      if (!prevListoRef.current.has(id)) {
        const m = data.mesas.find((x) => x.id_mesa === id);
        if (m) {
          beepListo();
          toast.success(`Mesa ${m.identificador}: pedido listo para recoger`, {
            icon: <Bell className="h-4 w-4" />,
          });
        }
      }
    }
    prevListoRef.current = ahora;
  }, [data?.mesas]);

  const [pagosOpen, setPagosOpen] = useState(false);
  const pagosFn = useServerFn(listarPagosPendientes);
  const pagosQ = useQuery({
    queryKey: ["pagos", "pendientes", "badge"],
    queryFn: () => pagosFn(),
    // Sin polling: el canal "pagos-badge" invalida cuando cambia un pago.
    staleTime: 60_000,
    enabled: !!data?.esAdmin,
  });
  // Realtime: refrescar badge cuando llegue/cambie un pago
  useEffect(() => {
    if (!data?.esAdmin) return;
    const ch = supabase
      .channel("pagos-badge")
      .on("postgres_changes", { event: "*", schema: "public", table: "pagos" }, () => {
        pagosQ.refetch();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [data?.esAdmin, pagosQ]);
  const pendCount = pagosQ.data?.pagos.length ?? 0;

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Mesas en servicio</h1>
          <p className="text-sm text-muted-foreground">
            {data?.esAdmin
              ? "Vista de todas las mesas del local."
              : "Mesas asignadas a ti."}
          </p>
        </div>
        {data?.esAdmin && (
          <Button
            variant={pendCount > 0 ? "default" : "outline"}
            onClick={() => setPagosOpen(true)}
            className="gap-2"
          >
            <Wallet className="h-4 w-4" />
            Pagos por confirmar
            {pendCount > 0 && (
              <Badge variant="secondary" className="ml-1">
                {pendCount}
              </Badge>
            )}
          </Button>
        )}
      </header>

      {!data?.esAdmin && <CajaTurnoCard />}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : !data || data.mesas.length === 0 ? (
        <div className="rounded-lg border bg-card p-12 text-center">
          <ChefHat className="mx-auto h-10 w-10 text-muted-foreground/50" />
          <p className="mt-3 text-sm text-muted-foreground">
            {data?.esAdmin
              ? "Aún no tienes mesas creadas. Crea la primera para empezar a recibir pedidos."
              : "No tienes mesas activas en este momento."}
          </p>
          {data?.esAdmin && (
            <Button asChild className="mt-4 gap-2">
              <Link to="/configuracion/mesas">
                <Plus className="h-4 w-4" />
                Crear primera mesa
              </Link>
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.mesas.map((m) => (
            <MesaCard key={m.id_mesa} m={m} />
          ))}
        </div>
      )}

      <PagosPendientesSheet open={pagosOpen} onOpenChange={setPagosOpen} />
    </div>
  );
}

function MesaCard({ m }: { m: MesaServicio }) {
  const ocupada = m.estado === "OCUPADA";
  return (
    <Link
      to="/servicio/$idMesa"
      params={{ idMesa: m.id_mesa }}
      className={`block rounded-xl border bg-card p-4 hover:shadow-md transition-shadow ${
        m.alerta_listo ? "ring-2 ring-emerald-500" : ""
      } ${m.solicitud_cliente ? "ring-2 ring-primary" : ""}`}
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

      <div className="mt-3 flex flex-wrap gap-1.5">
        {m.alerta_listo && (
          <Badge className="bg-emerald-600 text-white animate-pulse gap-1">
            <Bell className="h-3 w-3" /> Recoger
          </Badge>
        )}
        {m.solicitud_cliente === "CUENTA" && (
          <Badge variant="default" className="gap-1">
            <CreditCard className="h-3 w-3" /> Pide cuenta
          </Badge>
        )}
        {m.solicitud_cliente === "PEDIR_MAS" && (
          <Badge variant="default" className="gap-1">
            <Plus className="h-3 w-3" /> Pide más
          </Badge>
        )}
        {m.alerta_seguimiento && (
          <Badge variant="secondary" className="gap-1">
            <Clock className="h-3 w-3" /> Seguimiento
          </Badge>
        )}
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
