import { useState } from "react";
import { Loader2, Printer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { imprimirCopiaTicket } from "@/lib/impresion.functions";

/**
 * Reimprime el ticket de un pago como COPIA en la impresora del espacio CAJA (print-agent).
 * Mismo contrato que ImprimirCierreButton: cada clic encola un job → N clics = N copias.
 */
export function ImprimirTicketButton({
  idPago,
  label = "Imprimir copia",
  ...props
}: {
  idPago: string;
  label?: string;
} & Pick<React.ComponentProps<typeof Button>, "size" | "variant" | "className">) {
  const [enviando, setEnviando] = useState(false);

  const onClick = () => {
    setEnviando(true);
    imprimirCopiaTicket(idPago)
      .then((r) => {
        if (!r.encolado) {
          toast.info("CAJA no tiene impresora configurada");
        } else if (!r.agenteConectado) {
          toast.warning("No hay un agente de impresión conectado", {
            description: "La copia quedó en cola y se imprimirá al reconectar el PC de impresoras.",
          });
        } else {
          toast.success("Copia enviada a la impresora de caja");
        }
      })
      .catch((e) =>
        toast.error("No se pudo imprimir la copia", {
          description: e instanceof Error ? e.message : undefined,
        }),
      )
      .finally(() => setEnviando(false));
  };

  return (
    <Button onClick={onClick} disabled={enviando} {...props}>
      {enviando ? (
        <Loader2 className="mr-1 h-4 w-4 animate-spin" />
      ) : (
        <Printer className="mr-1 h-4 w-4" />
      )}
      {label}
    </Button>
  );
}
