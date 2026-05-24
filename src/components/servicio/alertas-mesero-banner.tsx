import { useEffect, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Bell, CreditCard, Plus, Check, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import {
  listarMesasServicio,
  limpiarSolicitudCliente,
  type MesaServicio,
} from "@/lib/servicio.functions";
import { beepListo } from "@/components/servicio/alerta-sound";

function minsAgo(iso: string | null) {
  if (!iso) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
}

export function AlertasMeseroBanner() {
  const fn = useServerFn(listarMesasServicio);
  const limpiar = useServerFn(limpiarSolicitudCliente);
  const qc = useQueryClient();
  const nav = useNavigate();

  const { data, refetch } = useQuery({
    queryKey: ["servicio", "mesas"],
    queryFn: () => fn(),
    refetchInterval: 10_000,
  });

  // Realtime
  useEffect(() => {
    const ch = supabase
      .channel("alertas-mesero-banner")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "mesas" },
        () => refetch(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [refetch]);

  const alertas = (data?.mesas ?? []).filter((m) => !!m.solicitud_cliente);

  // Beep + tick para refrescar "hace X min"
  const seen = useRef<Set<string>>(new Set());
  useEffect(() => {
    const ahora = new Set<string>();
    for (const m of alertas) {
      const key = `${m.id_mesa}:${m.solicitud_cliente}`;
      ahora.add(key);
      if (!seen.current.has(key)) {
        beepListo();
      }
    }
    seen.current = ahora;
  }, [alertas]);

  const limpiarMut = useMutation({
    mutationFn: (idMesa: string) => limpiar({ data: { idMesa } }),
    onSuccess: () => {
      toast.success("Solicitud atendida");
      qc.invalidateQueries({ queryKey: ["servicio", "mesas"] });
    },
    onError: (e) =>
      toast.error("No se pudo limpiar", {
        description: e instanceof Error ? e.message : undefined,
      }),
  });

  if (alertas.length === 0) return null;

  return (
    <div className="sticky top-0 z-30 -mx-4 px-4 py-2 space-y-2 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b">
      {alertas.map((m) => (
        <AlertaCard
          key={m.id_mesa}
          mesa={m}
          onIr={() => nav({ to: "/servicio/$idMesa", params: { idMesa: m.id_mesa } })}
          onAtendido={() => limpiarMut.mutate(m.id_mesa)}
          atendiendo={limpiarMut.isPending}
        />
      ))}
    </div>
  );
}

function AlertaCard({
  mesa,
  onIr,
  onAtendido,
  atendiendo,
}: {
  mesa: MesaServicio;
  onIr: () => void;
  onAtendido: () => void;
  atendiendo: boolean;
}) {
  const tipo = mesa.solicitud_cliente ?? "";
  const tiempo = minsAgo(mesa.solicitud_at);

  let styles = "";
  let icon = <Bell className="h-5 w-5" />;
  let titulo = "";
  if (tipo === "LLAMADO") {
    styles = "border-destructive bg-destructive/10 text-destructive";
    icon = <Bell className="h-5 w-5 animate-pulse" />;
    titulo = `Mesa ${mesa.identificador} te está llamando`;
  } else if (tipo === "CUENTA") {
    styles = "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
    icon = <CreditCard className="h-5 w-5" />;
    titulo = `Mesa ${mesa.identificador} pide la cuenta`;
  } else if (tipo === "PEDIR_MAS") {
    styles = "border-primary bg-primary/10 text-primary";
    icon = <Plus className="h-5 w-5" />;
    titulo = `Mesa ${mesa.identificador} quiere pedir más`;
  }

  return (
    <div className={`rounded-xl border-2 p-3 shadow-sm ${styles}`}>
      <div className="flex items-center gap-3">
        <div className="shrink-0">{icon}</div>
        <div className="min-w-0 flex-1">
          <p className="font-bold leading-tight">{titulo}</p>
          <p className="text-xs opacity-80">
            Hace {tiempo} min
            {mesa.mesero_nombre ? ` · ${mesa.mesero_nombre}` : ""}
          </p>
        </div>
      </div>
      <div className="mt-2 flex gap-2">
        <Button size="sm" className="flex-1 gap-1" onClick={onIr}>
          Ir a la mesa <ArrowRight className="h-4 w-4" />
        </Button>
        {tipo !== "LLAMADO" && (
          <Button
            size="sm"
            variant="outline"
            className="gap-1"
            onClick={onAtendido}
            disabled={atendiendo}
          >
            <Check className="h-4 w-4" /> Atendido
          </Button>
        )}
      </div>
    </div>
  );
}
