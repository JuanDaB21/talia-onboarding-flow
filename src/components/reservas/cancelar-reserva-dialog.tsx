import { useState } from "react";
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

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onConfirm: (devolver: boolean) => Promise<void> | void;
  loading?: boolean;
}

export function CancelarReservaDialog({ open, onOpenChange, onConfirm, loading }: Props) {
  const [pending, setPending] = useState<"devolver" | "retener" | null>(null);
  const handle = async (devolver: boolean) => {
    setPending(devolver ? "devolver" : "retener");
    try {
      await onConfirm(devolver);
    } finally {
      setPending(null);
    }
  };
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Cómo gestionas el abono?</AlertDialogTitle>
          <AlertDialogDescription>
            Decide si se devuelve el dinero al cliente o si el negocio lo retiene
            como penalidad por la cancelación.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2 sm:gap-2">
          <AlertDialogCancel disabled={loading || !!pending}>Volver</AlertDialogCancel>
          <AlertDialogAction
            disabled={loading || !!pending}
            onClick={(e) => {
              e.preventDefault();
              handle(true);
            }}
            className="bg-amber-600 hover:bg-amber-700"
          >
            {pending === "devolver" ? "Procesando..." : "Devolver dinero"}
          </AlertDialogAction>
          <AlertDialogAction
            disabled={loading || !!pending}
            onClick={(e) => {
              e.preventDefault();
              handle(false);
            }}
            className="bg-rose-600 hover:bg-rose-700"
          >
            {pending === "retener" ? "Procesando..." : "Retener dinero"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
