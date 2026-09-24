// Autogestión del mesero: "Tomar mesa". Si la mesa está libre la abre a su nombre; si la tiene
// otro compañero, pide confirmación y se la quita (POST /servicio/mesas/:id/tomar → tomar_mesa).
import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Hand, Loader2 } from "lucide-react";
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
import { tomarMesa } from "@/lib/servicio.functions";
import { desmarcarTomadaPorMi, marcarTomadaPorMi } from "./mesas-tomadas";

export function TomarMesaButton({
  idMesa,
  identificador,
  meseroActualNombre,
  ocupadaPorOtro,
  className,
  size = "sm",
}: {
  idMesa: string;
  identificador: string;
  meseroActualNombre: string | null;
  ocupadaPorOtro: boolean;
  className?: string;
  size?: "sm" | "default";
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const qc = useQueryClient();
  const navigate = useNavigate();

  const mut = useMutation({
    mutationFn: () => {
      marcarTomadaPorMi(idMesa);
      return tomarMesa(idMesa);
    },
    onSuccess: (r) => {
      toast.success(`Tomaste la mesa ${identificador}`, {
        description: r.abierta ? "La mesa quedó abierta a tu nombre." : "Ahora la atiendes tú.",
      });
      qc.invalidateQueries({ queryKey: ["servicio", "mesas"] });
      qc.invalidateQueries({ queryKey: ["mesaSesion", idMesa] });
      navigate({ to: "/servicio/$idMesa", params: { idMesa } });
    },
    onError: (e) => {
      desmarcarTomadaPorMi(idMesa);
      toast.error("No se pudo tomar la mesa", {
        description: e instanceof Error ? e.message : undefined,
      });
    },
  });

  return (
    <>
      <Button
        size={size}
        variant={ocupadaPorOtro ? "outline" : "default"}
        className={className ?? "w-full gap-1.5"}
        disabled={mut.isPending}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (ocupadaPorOtro) setConfirmOpen(true);
          else mut.mutate();
        }}
      >
        {mut.isPending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Hand className="h-3.5 w-3.5" />
        )}
        Tomar mesa
      </Button>
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Tomar la mesa {identificador}?</AlertDialogTitle>
            <AlertDialogDescription>
              {meseroActualNombre
                ? `La atiende ${meseroActualNombre}. Si la tomas, sus pedidos abiertos pasan a tu nombre y se le avisará.`
                : "Sus pedidos abiertos pasan a tu nombre."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => mut.mutate()}>Tomar mesa</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
