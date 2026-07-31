import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Printer, RefreshCcw, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { listarPrintJobs, reintentarPrintJob, descartarPrintJob } from "@/lib/impresion.functions";

/**
 * Monitor de impresión: muestra los trabajos con problema (ERROR) y los pendientes
 * (PENDIENTE = el agente aún no los imprimió, p.ej. desconectado). Reemplaza el
 * antiguo panel de alertas WebUSB del navegador.
 */
export function AlertasImpresion() {
  const { data, refetch } = useQuery({
    queryKey: ["print-jobs", "operacion"],
    queryFn: () => listarPrintJobs(40),
    refetchInterval: 8000,
  });
  const [retrying, setRetrying] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const jobs = data ?? [];
  const problemas = jobs.filter((j) => j.estado === "ERROR" && !dismissed.has(j.id_job));
  const pendientes = jobs.filter((j) => j.estado === "PENDIENTE");

  const handleRetry = async (id: string) => {
    setRetrying(id);
    try {
      const r = await reintentarPrintJob(id);
      toast[r.agenteConectado ? "success" : "warning"](
        r.agenteConectado ? "Reenviado a imprimir" : "Reencolado (sin agente conectado)",
      );
      await refetch();
    } catch (e) {
      toast.error("No se pudo reintentar", { description: e instanceof Error ? e.message : "" });
    } finally {
      setRetrying(null);
    }
  };

  const handleDescartar = async (id: string) => {
    // Oculta de inmediato y persiste en el backend (estado DESCARTADO) para que no
    // reaparezca al recargar. Si falla, se revierte la ocultación.
    setDismissed((s) => new Set(s).add(id));
    try {
      await descartarPrintJob(id);
      await refetch();
    } catch (e) {
      setDismissed((s) => {
        const n = new Set(s);
        n.delete(id);
        return n;
      });
      toast.error("No se pudo descartar", { description: e instanceof Error ? e.message : "" });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Printer className="h-4 w-4" /> Impresión
          {problemas.length > 0 && <Badge variant="destructive">{problemas.length}</Badge>}
          {pendientes.length > 0 && (
            <Badge variant="outline" className="text-amber-600">
              {pendientes.length} en cola
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {problemas.length === 0 && pendientes.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Todas las comandas se están imprimiendo bien.
          </p>
        )}

        {pendientes.length > 0 && problemas.length === 0 && (
          <p className="text-sm text-amber-600">
            {pendientes.length} comanda(s) en cola. Si no imprimen, revisa que el agente del PC de
            impresoras esté conectado (Configuración → Espacios de trabajo).
          </p>
        )}

        {problemas.map((j) => (
          <div
            key={j.id_job}
            className="rounded-md border border-destructive/40 bg-destructive/5 p-3 space-y-2"
          >
            <div className="flex items-start gap-2">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">No se pudo imprimir en {j.espacio_slug}</p>
                <p className="text-xs text-muted-foreground break-words">
                  {j.error ?? "Error desconocido"}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {new Date(j.created_at).toLocaleTimeString("es-CO", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
              <Button
                size="icon"
                variant="ghost"
                className="shrink-0 h-8 w-8 opacity-60 hover:opacity-100"
                aria-label="Descartar alerta"
                title="Descartar"
                onClick={() => handleDescartar(j.id_job)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <Button
              size="sm"
              onClick={() => handleRetry(j.id_job)}
              disabled={retrying === j.id_job}
            >
              <RefreshCcw className="h-3.5 w-3.5 mr-1" />
              {retrying === j.id_job ? "Reintentando…" : "Reintentar"}
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
