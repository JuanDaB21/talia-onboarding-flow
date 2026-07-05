import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Bell, ClipboardList, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  detenerAlertaLlamado,
  tomarPedidoLlamado,
} from "@/lib/servicio.functions";

interface Props {
  idMesa: string;
  identificador: string;
  solicitudAt: string | null;
}

export function LlamadoPanel({ idMesa, identificador, solicitudAt }: Props) {
  const qc = useQueryClient();
  const nav = useNavigate();

  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);
  void tick;

  const tiempo = solicitudAt
    ? Math.max(0, Math.floor((Date.now() - new Date(solicitudAt).getTime()) / 60000))
    : 0;

  const detener = useMutation({
    mutationFn: () => detenerAlertaLlamado(idMesa),
    onSuccess: () => {
      toast.success(`Alerta de mesa ${identificador} detenida`);
      qc.invalidateQueries({ queryKey: ["servicio", "mesas"] });
      qc.invalidateQueries({ queryKey: ["mesaSesion", idMesa] });
      nav({ to: "/servicio" });
    },
    onError: (e) =>
      toast.error("No se pudo detener", {
        description: e instanceof Error ? e.message : undefined,
      }),
  });

  const tomar = useMutation({
    mutationFn: () => tomarPedidoLlamado(idMesa),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mesaSesion", idMesa] });
      qc.invalidateQueries({ queryKey: ["servicio", "mesas"] });
    },
    onError: (e) =>
      toast.error("No se pudo tomar el pedido", {
        description: e instanceof Error ? e.message : undefined,
      }),
  });

  const busy = detener.isPending || tomar.isPending;

  return (
    <div className="rounded-2xl border-2 border-destructive bg-destructive/10 p-5 shadow-lg">
      <div className="flex items-center gap-3">
        <Bell className="h-7 w-7 text-destructive animate-pulse" />
        <div className="min-w-0 flex-1">
          <p className="text-lg font-bold text-destructive">
            Mesa {identificador} te llamó
          </p>
          <p className="text-sm text-destructive/80">
            Hace {tiempo} min · ¿ya llegaste a la mesa?
          </p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Button
          size="lg"
          variant="outline"
          className="h-14 text-base border-destructive text-destructive hover:bg-destructive/10"
          onClick={() => detener.mutate()}
          disabled={busy}
        >
          {detener.isPending ? (
            <Loader2 className="h-5 w-5 mr-2 animate-spin" />
          ) : (
            <XCircle className="h-5 w-5 mr-2" />
          )}
          Detener alerta
        </Button>
        <Button
          size="lg"
          className="h-14 text-base"
          onClick={() => tomar.mutate()}
          disabled={busy}
        >
          {tomar.isPending ? (
            <Loader2 className="h-5 w-5 mr-2 animate-spin" />
          ) : (
            <ClipboardList className="h-5 w-5 mr-2" />
          )}
          Tomar pedido
        </Button>
      </div>
    </div>
  );
}
