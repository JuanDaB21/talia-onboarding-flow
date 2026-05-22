import { QRCodeSVG } from "qrcode.react";
import { QrCode } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { Mesa } from "@/lib/mesas-schemas";

interface Props {
  mesa: Mesa;
  onClick: () => void;
}

export function MesaCard({ mesa, onClick }: Props) {
  const url =
    typeof window !== "undefined"
      ? `${window.location.origin}/menu?mesa=${mesa.id_mesa}`
      : `/menu?mesa=${mesa.id_mesa}`;
  const ocupada = mesa.estado === "OCUPADA";
  return (
    <Card
      onClick={onClick}
      className="cursor-pointer p-4 flex flex-col items-center gap-3 hover:border-primary transition-colors"
    >
      <div className="flex w-full items-start justify-between">
        <h3 className="font-semibold text-sm truncate" title={mesa.identificador}>
          {mesa.identificador}
        </h3>
        <Badge variant={ocupada ? "destructive" : "secondary"} className="shrink-0">
          {ocupada ? "Ocupada" : "Libre"}
        </Badge>
      </div>
      <div className="bg-white p-2 rounded-md border">
        <QRCodeSVG value={url} size={96} level="M" />
      </div>
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <QrCode className="h-3 w-3" />
        Ver QR
      </div>
    </Card>
  );
}
