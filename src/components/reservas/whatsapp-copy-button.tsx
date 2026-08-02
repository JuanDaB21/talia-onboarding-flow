import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { MessageCircle } from "lucide-react";

const fmt = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

/**
 * Deja el número listo para un link `wa.me`, que exige indicativo de país.
 * Quita todo lo no numérico; si son 10 dígitos (móvil colombiano típico) antepone
 * el indicativo por defecto; si ya trae indicativo, lo respeta. "" si no hay número.
 */
function normalizarTelefonoWa(telefono: string, indicativoDefault = "57"): string {
  const soloDigitos = telefono.replace(/\D/g, "");
  if (!soloDigitos) return "";
  return soloDigitos.length === 10 ? indicativoDefault + soloDigitos : soloDigitos;
}

interface Props {
  nombre: string;
  fecha: string;
  hora: string;
  codigo: string;
  monto: number;
  telefono?: string | null;
  negocio?: string | null;
}

export function WhatsappCopyButton({ nombre, fecha, hora, codigo, monto, telefono, negocio }: Props) {
  const handle = async () => {
    const fechaFmt = new Date(fecha + "T00:00:00").toLocaleDateString("es-CO", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
    const nombreNegocio = (negocio ?? "").trim() || "nuestro restaurante";
    const msg = `¡Hola ${nombre}! Tu reserva en ${nombreNegocio} para el ${fechaFmt} a las ${hora} ha sido registrada. Código de reserva: ${codigo}. Abono: ${fmt.format(monto)}. ¡Te esperamos!`;
    try {
      await navigator.clipboard.writeText(msg);
      toast.success("Mensaje copiado");
      const tel = normalizarTelefonoWa(telefono ?? "");
      if (tel) {
        const url = `https://wa.me/${tel}?text=${encodeURIComponent(msg)}`;
        window.open(url, "_blank", "noopener,noreferrer");
      }
    } catch {
      toast.error("No se pudo copiar el mensaje");
    }
  };
  return (
    <Button variant="outline" size="sm" onClick={handle}>
      <MessageCircle className="h-3.5 w-3.5 mr-1" />
      WhatsApp
    </Button>
  );
}
