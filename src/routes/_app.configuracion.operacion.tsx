import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Clock, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getNegocioConfig,
  updateNegocioCierreTurno,
  updateNegocioDiaOperativo,
  type NegocioConfig,
} from "@/lib/negocio.functions";
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
          Ajustes del ciclo de trabajo: cierre automático de turnos y día operativo de caja.
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

      <DiaOperativoCard data={data} />
    </div>
  );
}

function DiaOperativoCard({ data }: { data: NegocioConfig }) {
  const qc = useQueryClient();
  const [inicio, setInicio] = useState<string>("00:00");
  const [duracion, setDuracion] = useState<string>("24");

  useEffect(() => {
    setInicio(data.dia_operativo_inicio ?? "00:00");
    setDuracion(String(data.dia_operativo_duracion_horas ?? 24));
  }, [data]);

  const mut = useMutation({
    mutationFn: () =>
      updateNegocioDiaOperativo({
        dia_operativo_inicio: inicio,
        dia_operativo_duracion_horas: Number(duracion),
      }),
    onSuccess: () => {
      toast.success("Día operativo actualizado");
      qc.invalidateQueries({ queryKey: ["negocio-config"] });
    },
    onError: (e) => {
      const msg = e instanceof Error ? e.message : "";
      toast.error("No se pudo guardar", {
        description: msg.includes("CAJA_ABIERTA")
          ? "Cierra la caja del día antes de cambiar el inicio del día operativo."
          : msg || undefined,
      });
    },
  });

  const dur = Number(duracion);
  const inicioValido = /^([01]\d|2[0-3]):[0-5]\d$/.test(inicio);
  const durValida = Number.isInteger(dur) && dur >= 1 && dur <= 24;
  const cambiado =
    inicioValido &&
    durValida &&
    (inicio !== data.dia_operativo_inicio || dur !== data.dia_operativo_duracion_horas);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarClock className="h-4 w-4" /> Día operativo de caja
        </CardTitle>
        <CardDescription>
          La caja y su historial se registran con la fecha del día en que inicia la jornada. Ej.:
          si el día inicia a las 3:00 p.&nbsp;m., una caja cerrada a la 1:00 a.&nbsp;m. pertenece
          al día anterior. La apertura y el cierre de la caja siguen siendo manuales.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="dia-op-inicio">Hora de inicio</Label>
            <Input
              id="dia-op-inicio"
              type="time"
              value={inicio}
              onChange={(e) => setInicio(e.target.value)}
              className="max-w-[160px]"
            />
            {!inicioValido && <p className="text-xs text-destructive">Hora inválida.</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="dia-op-duracion">Duración de la jornada</Label>
            <div className="flex items-center gap-2 max-w-[160px]">
              <Input
                id="dia-op-duracion"
                type="number"
                min={1}
                max={24}
                step="1"
                value={duracion}
                onChange={(e) => setDuracion(e.target.value)}
              />
              <span className="text-sm text-muted-foreground">horas</span>
            </div>
            {!durValida && (
              <p className="text-xs text-destructive">Debe ser un número entero entre 1 y 24.</p>
            )}
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={() => mut.mutate()} disabled={!cambiado || mut.isPending} className="gap-2">
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
  );
}
