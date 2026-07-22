import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Coins, Loader2, Receipt, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  getNegocioConfig,
  updateNegocioPropinaSugerida,
  updateNegocioPropinas,
} from "@/lib/negocio.functions";
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

  const { data, isLoading } = useQuery({
    queryKey: ["negocio-config"],
    queryFn: () => getNegocioConfig(),
  });

  const [valor, setValor] = useState<string>("0");
  const [pctSugerida, setPctSugerida] = useState<string>("10");
  const [mensaje, setMensaje] = useState<string>("");

  useEffect(() => {
    if (!data) return;
    setValor(String(data.porcentaje_retencion_propina ?? 0));
    setPctSugerida(String(data.propina_pct_sugerida ?? 10));
    setMensaje(data.propina_mensaje ?? "");
  }, [data]);

  const onError = (e: unknown) =>
    toast.error("No se pudo guardar", {
      description: e instanceof Error ? e.message : undefined,
    });

  const mut = useMutation({
    mutationFn: (pct: number) => updateNegocioPropinas({ porcentaje_retencion_propina: pct }),
    onSuccess: () => {
      toast.success("Porcentaje actualizado");
      qc.invalidateQueries({ queryKey: ["negocio-config"] });
    },
    onError,
  });

  const mutSugerida = useMutation({
    mutationFn: (input: { propina_pct_sugerida: number; propina_mensaje: string }) =>
      updateNegocioPropinaSugerida(input),
    onSuccess: () => {
      toast.success("Propina sugerida actualizada");
      qc.invalidateQueries({ queryKey: ["negocio-config"] });
    },
    onError,
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

  const numSug = Number(pctSugerida);
  const sugValido = Number.isFinite(numSug) && numSug >= 0 && numSug <= 100;
  const mensajeValido = mensaje.trim().length <= 300;
  const sugCambiado =
    sugValido &&
    mensajeValido &&
    (numSug !== Number(data.propina_pct_sugerida ?? 10) ||
      mensaje.trim() !== (data.propina_mensaje ?? "").trim());

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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Receipt className="h-4 w-4" /> Propina sugerida al cliente
          </CardTitle>
          <CardDescription>
            Se imprime en la precuenta y ya viene sumada en el total. El cajero puede cambiarla o
            quitarla al momento de cobrar.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="pct-sugerida">Porcentaje sugerido (%)</Label>
            <div className="flex items-center gap-2 max-w-xs">
              <Input
                id="pct-sugerida"
                type="number"
                min={0}
                max={100}
                step="0.01"
                value={pctSugerida}
                onChange={(e) => setPctSugerida(e.target.value)}
              />
              <span className="text-sm text-muted-foreground">%</span>
            </div>
            {!sugValido && (
              <p className="text-xs text-destructive">Debe ser un número entre 0 y 100.</p>
            )}
            <p className="text-xs text-muted-foreground">
              Con 0% la precuenta se imprime sin propina.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="propina-mensaje">Mensaje en la precuenta</Label>
            <Textarea
              id="propina-mensaje"
              rows={3}
              maxLength={300}
              placeholder="La propina es voluntaria y será repartida entre todo el equipo de trabajo."
              value={mensaje}
              onChange={(e) => setMensaje(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              {mensaje.trim().length}/300 caracteres. Déjalo vacío para no imprimir ningún aviso.
            </p>
          </div>

          <div className="flex justify-end">
            <Button
              onClick={() =>
                mutSugerida.mutate({
                  propina_pct_sugerida: numSug,
                  propina_mensaje: mensaje.trim(),
                })
              }
              disabled={!sugCambiado || mutSugerida.isPending}
              className="gap-2"
            >
              {mutSugerida.isPending ? (
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
