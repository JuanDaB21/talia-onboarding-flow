import { useState } from "react";
import { Loader2, Printer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { imprimirCierre } from "@/lib/impresion.functions";

/**
 * Manda el reporte de un cierre a la impresora del espacio CAJA (print-agent).
 * Sustituye al window.print() del navegador, que mandaba HTML con fuentes del
 * sistema y salía ilegible en la térmica.
 */
export function ImprimirCierreButton({
  idCaja,
  label = "Imprimir",
  ...props
}: {
  idCaja: string;
  label?: string;
} & Pick<React.ComponentProps<typeof Button>, "size" | "variant" | "className">) {
  const [enviando, setEnviando] = useState(false);

  const onClick = () => {
    setEnviando(true);
    imprimirCierre(idCaja)
      .then((r) => {
        if (!r.encolado) {
          toast.info("CAJA no tiene impresora configurada");
        } else if (!r.agenteConectado) {
          toast.warning("No hay un agente de impresión conectado", {
            description: "El cierre quedó en cola y se imprimirá al reconectar el PC de impresoras.",
          });
        } else {
          toast.success("Cierre enviado a la impresora de caja");
        }
      })
      .catch((e) =>
        toast.error("No se pudo imprimir el cierre", {
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
