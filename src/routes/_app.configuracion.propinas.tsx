import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Coins, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getNegocioConfig, updateNegocioPropinas } from "@/lib/negocio.functions";
import { AdminGate } from "@/components/admin/admin-gate";

export const Route = createFileRoute("/_app/configuracion/propinas")({
  head: () => ({ meta: [{ title: "Propinas — Talia" }] }),
  component: () => (
    <AdminGate>
      <PropinasConfigPage />
    </AdminGate>
  ),
});

function PropinasConfigPage() {
  const qc = useQueryClient();
  const getCfg = useServerFn(getNegocioConfig);
  const updateProp = useServerFn(updateNegocioPropinas);

  const { data, isLoading } = useQuery({
    queryKey: ["negocio-config"],
    queryFn: () => getCfg(),
  });

  const [valor, setValor] = useState<string>("0");

  useEffect(() => {
    if (data) setValor(String(data.porcentaje_retencion_propina ?? 0));
  }, [data]);

  const mut = useMutation({
    mutationFn: (pct: number) => updateProp({ data: { porcentaje_retencion_propina: pct } }),
    onSuccess: () => {
      toast.success("Porcentaje actualizado");
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
  const valido = Number.isFinite(num) && num >= 0 && num <= 100;
  const cambiado = valido && num !== Number(data.porcentaje_retencion_propina ?? 0);

  return (
    <div className="container mx-auto max-w-2xl px-4 py-6 space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Propinas</h1>
        <p className="text-sm text-muted-foreground">
          Configura cuánto retiene el negocio del total de propinas antes del reparto a meseros.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Coins className="h-4 w-4" /> Retención del negocio
          </CardTitle>
          <CardDescription>
            Porcentaje de las propinas que se queda el negocio. El resto se reparte entre los
            meseros en turno del día. El último valor guardado es el que se usa para calcular.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="pct">Porcentaje de retención (%)</Label>
            <div className="flex items-center gap-2 max-w-xs">
              <Input
                id="pct"
                type="number"
                min={0}
                max={100}
                step="0.01"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
              />
              <span className="text-sm text-muted-foreground">%</span>
            </div>
            {!valido && (
              <p className="text-xs text-destructive">Debe ser un número entre 0 y 100.</p>
            )}
            <p className="text-xs text-muted-foreground">
              Reparto a meseros: {valido ? (100 - num).toFixed(2) : "—"}%.
            </p>
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
