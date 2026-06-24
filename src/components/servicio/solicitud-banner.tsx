import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, ClipboardCheck, CreditCard, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { limpiarSolicitudCliente } from "@/lib/servicio.functions";

interface Props {
  idMesa: string;
  tipo: "CUENTA" | "PEDIR_MAS" | "TOMAR_PEDIDO";
  solicitudAt: string | null;
}

export function SolicitudBanner({ idMesa, tipo, solicitudAt }: Props) {
  const qc = useQueryClient();
  const fn = useServerFn(limpiarSolicitudCliente);
  const mut = useMutation({
    mutationFn: () => fn({ data: { idMesa } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mesaSesion", idMesa] });
      qc.invalidateQueries({ queryKey: ["servicio", "mesas"] });
      toast.success("Solicitud atendida");
    },
    onError: (e) =>
      toast.error("No se pudo limpiar", {
        description: e instanceof Error ? e.message : undefined,
      }),
  });

  const tiempo = solicitudAt
    ? Math.max(0, Math.floor((Date.now() - new Date(solicitudAt).getTime()) / 60000))
    : 0;

  let styles = "border-primary bg-primary/10 text-primary";
  let titulo = "El cliente quiere pedir más";
  let Icon = Plus;
  if (tipo === "CUENTA") {
    styles = "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
    titulo = "El cliente pide la cuenta";
    Icon = CreditCard;
  } else if (tipo === "TOMAR_PEDIDO") {
    styles = "border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-300";
    titulo = "El cliente terminó su pedido — ve a tomarlo";
    Icon = ClipboardCheck;
  }


  return (
    <div className={`rounded-xl border-2 p-4 shadow-sm ${styles}`}>
      <div className="flex items-center gap-3">
        <Icon className="h-6 w-6 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="font-bold leading-tight">{titulo}</p>
          <p className="text-xs opacity-80">Hace {tiempo} min</p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => mut.mutate()}
          disabled={mut.isPending}
          className="gap-1"
        >
          {mut.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Check className="h-4 w-4" />
          )}
          Atendido
        </Button>
      </div>
    </div>
  );
}
