import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { MessageCircle } from "lucide-react";

const fmt = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

interface Props {
  nombre: string;
  fecha: string;
  hora: string;
  codigo: string;
  monto: number;
  telefono?: string | null;
}

export function WhatsappCopyButton({ nombre, fecha, hora, codigo, monto, telefono }: Props) {
  const handle = async () => {
    const fechaFmt = new Date(fecha + "T00:00:00").toLocaleDateString("es-CO", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
    const msg = `¡Hola ${nombre}! Tu reserva en TALIA para el ${fechaFmt} a las ${hora} ha sido registrada. Código de reserva: ${codigo}. Abono: ${fmt.format(monto)}. ¡Te esperamos!`;
    try {
      await navigator.clipboard.writeText(msg);
      toast.success("Mensaje copiado");
      const tel = (telefono ?? "").replace(/\D/g, "");
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
