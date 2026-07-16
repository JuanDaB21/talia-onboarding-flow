import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getNegocioConfig, updateNegocioCierreTurno } from "@/lib/negocio.functions";
import { AdminGate } from "@/components/admin/admin-gate";

export const Route = createFileRoute("/_app/configuracion/operacion")({
  head: () => ({ meta: [{ title: "Operación — Talia" }] }),
  component: () => (
    <AdminGate>
      <OperacionConfigPage />
    </AdminGate>
  ),
});

function OperacionConfigPage() {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["negocio-config"],
    queryFn: () => getNegocioConfig(),
  });

  const [valor, setValor] = useState<string>("12");

  useEffect(() => {
    if (data) setValor(String(data.auto_cierre_turno_horas ?? 12));
  }, [data]);

  const mut = useMutation({
    mutationFn: (horas: number) => updateNegocioCierreTurno({ auto_cierre_turno_horas: horas }),
    onSuccess: () => {
      toast.success("Cierre de turno actualizado");
      qc.invalidateQueries({ queryKey: ["negocio-config"] });
    },
    onError: (e) =>
      toast.error("No se pudo guardar", {
        description: e instanceof Error ? e.message : undefined,
      }),
  });

  if (isLoading || !data) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const num = Number(valor);
  const valido = Number.isInteger(num) && num >= 1 && num <= 24;
  const cambiado = valido && num !== Number(data.auto_cierre_turno_horas ?? 12);

  return (
    <div className="container mx-auto max-w-2xl px-4 py-6 space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Operación</h1>
        <p className="text-sm text-muted-foreground">
          Ajustes del ciclo de trabajo: cierre automático de turnos.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="h-4 w-4" /> Cierre automático de turno
          </CardTitle>
          <CardDescription>
            Horas desde que un trabajador inicia su turno tras las que se cierra
            automáticamente (se mide por antigüedad del turno, no por inactividad). El sistema
            revisa cada 15 minutos. Mínimo 1 hora, máximo 24.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="horas">Horas hasta el cierre automático</Label>
            <div className="flex items-center gap-2 max-w-xs">
              <Input
                id="horas"
                type="number"
                min={1}
                max={24}
                step="1"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
              />
              <span className="text-sm text-muted-foreground">horas</span>
            </div>
            {!valido && (
              <p className="text-xs text-destructive">Debe ser un número entero entre 1 y 24.</p>
            )}
          </div>

          <div className="flex justify-end">
            <Button
              onClick={() => mut.mutate(num)}
              disabled={!cambiado || mut.isPending}
              className="gap-2"
            >
              {mut.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Guardar
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
