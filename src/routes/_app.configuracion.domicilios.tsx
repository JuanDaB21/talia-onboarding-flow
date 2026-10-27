import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bike,
  Copy,
  ExternalLink,
  Loader2,
  MapPin,
  MessageCircle,
  Plus,
  Save,
  ShoppingBag,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { AdminGate } from "@/components/admin/admin-gate";
import { InstagramIcon } from "@/components/menu-publico/pedido/iconos-marca";
import { useCurrentNegocio } from "@/hooks/use-current-negocio";
import { getNegocioConfig, updateNegocioDomicilios } from "@/lib/negocio.functions";
import {
  eliminarMunicipio,
  guardarMunicipio,
  listarMunicipios,
  type MunicipioEnvio,
} from "@/lib/domicilios.functions";

export const Route = createFileRoute("/_app/configuracion/domicilios")({
  head: () => ({ meta: [{ title: "Domicilios y redes — Talia" }] }),
  component: () => (
    <AdminGate>
      <DomiciliosConfigPage />
    </AdminGate>
  ),
});

const COP = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

const onError = (e: unknown) =>
  toast.error("No se pudo guardar", { description: e instanceof Error ? e.message : undefined });

function DomiciliosConfigPage() {
  const qc = useQueryClient();
  const { idNegocio } = useCurrentNegocio();
  const { data, isLoading } = useQuery({
    queryKey: ["negocio-config"],
    queryFn: () => getNegocioConfig(),
  });

  const [domicilios, setDomicilios] = useState(false);
  const [recoger, setRecoger] = useState(false);
  const [tiempo, setTiempo] = useState("");
  const [minimo, setMinimo] = useState("0");
  const [whatsapp, setWhatsapp] = useState("");
  const [instagram, setInstagram] = useState("");

  useEffect(() => {
    if (!data) return;
    setDomicilios(data.domicilios_activo);
    setRecoger(data.recoger_activo);
    setTiempo(data.tiempo_estimado_min == null ? "" : String(data.tiempo_estimado_min));
    setMinimo(String(data.pedido_minimo ?? 0));
    setWhatsapp(data.whatsapp_numero ?? "");
    setInstagram(data.instagram_url ?? "");
  }, [data]);

  const mut = useMutation({
    mutationFn: updateNegocioDomicilios,
    onSuccess: () => {
      toast.success("Cambios guardados");
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

  const tiempoNum = tiempo.trim() === "" ? null : Number(tiempo);
  const tiempoOk =
    tiempoNum === null || (Number.isInteger(tiempoNum) && tiempoNum >= 5 && tiempoNum <= 240);
  const minimoNum = Number(minimo || 0);
  const minimoOk = Number.isFinite(minimoNum) && minimoNum >= 0;
  const waOk = whatsapp.trim() === "" || /^\+?[\d\s-]{7,20}$/.test(whatsapp.trim());
  const igOk = instagram.trim() === "" || /^https?:\/\/\S+$/.test(instagram.trim());
  const valido = tiempoOk && minimoOk && waOk && igOk;

  const urlCarta =
    typeof window !== "undefined" && idNegocio
      ? `${window.location.origin}/carta-publica/${idNegocio}`
      : null;

  return (
    <div className="container mx-auto max-w-3xl space-y-6 px-4 py-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Domicilios y redes</h1>
        <p className="text-sm text-muted-foreground">
          Recibe pedidos desde la carta pública: a domicilio o para recoger. Llegan al módulo{" "}
          <Link
            to="/domicilios"
            className="font-medium text-primary underline-offset-2 hover:underline"
          >
            Domicilios
          </Link>{" "}
          para confirmarlos antes de pasar a cocina.
        </p>
      </header>

      {urlCarta && (
        <Card>
          <CardContent className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">Enlace de tu carta</p>
              <p className="truncate font-mono text-xs text-muted-foreground">{urlCarta}</p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => {
                  void navigator.clipboard?.writeText(urlCarta);
                  toast.success("Enlace copiado");
                }}
              >
                <Copy className="h-3.5 w-3.5" /> Copiar
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5" asChild>
                <a href={urlCarta} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-3.5 w-3.5" /> Abrir
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShoppingBag className="h-4 w-4" /> Pedidos en línea
          </CardTitle>
          <CardDescription>
            Activa los tipos de pedido que aceptas. Con ambos apagados la carta solo muestra el
            menú.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ToggleRow
            icon={<Bike className="h-4 w-4" />}
            titulo="Domicilios"
            descripcion="Pago en efectivo contra entrega o por transferencia. El envío se cobra según el municipio."
            checked={domicilios}
            onChange={setDomicilios}
          />
          <ToggleRow
            icon={<ShoppingBag className="h-4 w-4" />}
            titulo="Para recoger"
            descripcion="El cliente paga en el local o por transferencia."
            checked={recoger}
            onChange={setRecoger}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="tiempo">Tiempo estimado (min)</Label>
              <Input
                id="tiempo"
                type="number"
                min={5}
                max={240}
                placeholder="Ej. 40"
                value={tiempo}
                onChange={(e) => setTiempo(e.target.value)}
              />
              {!tiempoOk && <p className="text-xs text-destructive">Entre 5 y 240 minutos.</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="minimo">Pedido mínimo (sin envío)</Label>
              <Input
                id="minimo"
                type="number"
                min={0}
                step={1000}
                value={minimo}
                onChange={(e) => setMinimo(e.target.value)}
              />
              {!minimoOk && <p className="text-xs text-destructive">Valor inválido.</p>}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageCircle className="h-4 w-4" /> Contacto en la carta
          </CardTitle>
          <CardDescription>
            Botones flotantes para que el cliente escriba a caja (pedidos, estado del domicilio) o
            visite tu Instagram.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="wa">WhatsApp de caja</Label>
            <Input
              id="wa"
              inputMode="tel"
              placeholder="+57 300 123 4567"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
            />
            {!waOk && <p className="text-xs text-destructive">Número inválido.</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ig" className="flex items-center gap-1.5">
              <InstagramIcon className="h-3.5 w-3.5" /> Instagram
            </Label>
            <Input
              id="ig"
              inputMode="url"
              placeholder="https://instagram.com/tunegocio"
              value={instagram}
              onChange={(e) => setInstagram(e.target.value)}
            />
            {!igOk && (
              <p className="text-xs text-destructive">Usa el enlace completo (https://…).</p>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button
          className="gap-2"
          disabled={!valido || mut.isPending}
          onClick={() =>
            mut.mutate({
              domicilios_activo: domicilios,
              recoger_activo: recoger,
              tiempo_estimado_min: tiempoNum,
              pedido_minimo: minimoNum,
              whatsapp_numero: whatsapp.trim() || null,
              instagram_url: instagram.trim() || null,
            })
          }
        >
          {mut.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Guardar
        </Button>
      </div>

      <MunicipiosCard />

      <p className="text-xs text-muted-foreground">
        Para pagos por transferencia, marca “Mostrar en la carta pública” en{" "}
        <Link
          to="/configuracion/metodos-pago"
          className="text-primary underline-offset-2 hover:underline"
        >
          Métodos de pago
        </Link>{" "}
        y agrega el número de cuenta o llave.
      </p>
    </div>
  );
}

function ToggleRow({
  icon,
  titulo,
  descripcion,
  checked,
  onChange,
}: {
  icon: React.ReactNode;
  titulo: string;
  descripcion: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-start justify-between gap-4 rounded-lg border p-3">
      <span className="flex gap-3">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          {icon}
        </span>
        <span>
          <span className="block text-sm font-medium">{titulo}</span>
          <span className="block text-xs text-muted-foreground">{descripcion}</span>
        </span>
      </span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  );
}

function MunicipiosCard() {
  const qc = useQueryClient();
  const { data: municipios = [], isLoading } = useQuery({
    queryKey: ["domicilios", "municipios"],
    queryFn: listarMunicipios,
  });
  const [nombre, setNombre] = useState("");
  const [costo, setCosto] = useState("");

  const invalidar = () => qc.invalidateQueries({ queryKey: ["domicilios", "municipios"] });
  const guardar = useMutation({
    mutationFn: guardarMunicipio,
    onSuccess: () => {
      invalidar();
      setNombre("");
      setCosto("");
    },
    onError,
  });
  const eliminar = useMutation({ mutationFn: eliminarMunicipio, onSuccess: invalidar, onError });

  const costoNum = Number(costo);
  const puedeAgregar = nombre.trim().length > 0 && costo !== "" && costoNum >= 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <MapPin className="h-4 w-4" /> Municipios y costo de envío
        </CardTitle>
        <CardDescription>
          El cliente elige su municipio al pedir a domicilio y se suma este valor al total.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : municipios.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aún no hay municipios. Sin al menos uno activo no se pueden pedir domicilios.
          </p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {municipios.map((m) => (
              <MunicipioRow
                key={m.id_municipio}
                m={m}
                onToggle={(activo) =>
                  guardar.mutate({
                    idMunicipio: m.id_municipio,
                    nombre: m.nombre,
                    costoEnvio: m.costo_envio,
                    activo,
                    orden: m.orden,
                  })
                }
                onDelete={() => eliminar.mutate(m.id_municipio)}
              />
            ))}
          </ul>
        )}
        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            if (!puedeAgregar) return;
            guardar.mutate({
              nombre: nombre.trim(),
              costoEnvio: costoNum,
              activo: true,
              orden: municipios.length,
            });
          }}
        >
          <Input
            placeholder="Municipio (ej. Piedecuesta)"
            value={nombre}
            onChange={(e) => setNombre(e.target.value.slice(0, 80))}
          />
          <Input
            type="number"
            min={0}
            step={500}
            placeholder="Costo de envío"
            value={costo}
            onChange={(e) => setCosto(e.target.value)}
            className="sm:w-44"
          />
          <Button type="submit" className="gap-1.5" disabled={!puedeAgregar || guardar.isPending}>
            <Plus className="h-4 w-4" /> Agregar
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function MunicipioRow({
  m,
  onToggle,
  onDelete,
}: {
  m: MunicipioEnvio;
  onToggle: (activo: boolean) => void;
  onDelete: () => void;
}) {
  return (
    <li className="flex items-center gap-3 px-3 py-2">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{m.nombre}</p>
        <p className="text-xs text-muted-foreground">{COP.format(m.costo_envio)}</p>
      </div>
      <Switch checked={m.activo} onCheckedChange={onToggle} aria-label={`Activar ${m.nombre}`} />
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-muted-foreground hover:text-destructive"
        onClick={onDelete}
        aria-label={`Eliminar ${m.nombre}`}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </li>
  );
}
