import { toast } from "sonner";
import { Printer, RefreshCcw, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  usePrinterAlerts,
  dispatchComandas,
} from "@/services/printDispatch";
import { dismissPrinterAlert, markRetrying } from "@/services/printerAlerts";
import { imprimirComandas } from "@/components/preparacion/comanda-print";

export function AlertasImpresion() {
  const alerts = usePrinterAlerts();

  const handleRetry = async (id: string, slug: string) => {
    markRetrying(id, true);
    try {
      const alert = alerts.find((a) => a.id === id);
      if (!alert) return;
      await dispatchComandas([alert.comanda]);
      // Si tras el intento sigue sin haberse marcado como fallo nuevo, la asumimos exitosa
      // (dispatchComandas re-agrega la alerta si vuelve a fallar).
      dismissPrinterAlert(id);
      toast.success(`Comanda reenviada a ${slug}`);
    } catch (e) {
      toast.error("Reintento fallido", { description: e instanceof Error ? e.message : "" });
    } finally {
      markRetrying(id, false);
    }
  };

  const handleManual = async (id: string) => {
    const alert = alerts.find((a) => a.id === id);
    if (!alert) return;
    await imprimirComandas([alert.comanda]);
    dismissPrinterAlert(id);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Printer className="h-4 w-4" /> Alertas de impresión
          {alerts.length > 0 && <Badge variant="destructive">{alerts.length}</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {alerts.length === 0 && (
          <p className="text-sm text-muted-foreground">Todas las comandas se están imprimiendo bien.</p>
        )}
        {alerts.map((a) => (
          <div key={a.id} className="rounded-md border border-destructive/40 bg-destructive/5 p-3 space-y-2">
            <div className="flex items-start gap-2">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">
                  Impresora de {a.espacio_nombre} no responde
                </p>
                <p className="text-xs text-muted-foreground">
                  {a.motivo} · Pedido #{a.comanda.pedido_id.slice(0, 6)} ·{" "}
                  Mesa {a.comanda.mesa_identificador}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {new Date(a.ocurrido_at).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={() => dismissPrinterAlert(a.id)}
                aria-label="Descartar"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="default"
                onClick={() => handleRetry(a.id, a.espacio_nombre)}
                disabled={a.reintentando}
              >
                <RefreshCcw className="h-3.5 w-3.5 mr-1" />
                {a.reintentando ? "Reintentando…" : "Reintentar USB"}
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleManual(a.id)}>
                Imprimir manual
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
