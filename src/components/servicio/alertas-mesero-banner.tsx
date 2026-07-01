import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Bell,
  CreditCard,
  Plus,
  Check,
  ArrowRight,
  ClipboardCheck,
  PackageCheck,
  UserPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import {
  listarMesasServicio,
  limpiarSolicitudCliente,
  type MesaServicio,
} from "@/lib/servicio.functions";
import { useAlertaBus, type AlertaItem } from "@/components/servicio/alerta-bus";

function minsAgo(iso: string | null) {
  if (!iso) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
}

export function AlertasMeseroBanner() {
  const fn = useServerFn(listarMesasServicio);
  const limpiar = useServerFn(limpiarSolicitudCliente);
  const qc = useQueryClient();
  const nav = useNavigate();
  const bus = useAlertaBus();

  const { data, refetch } = useQuery({
    queryKey: ["servicio", "mesas"],
    queryFn: () => fn(),
    staleTime: 60_000,
  });

  useEffect(() => {
    const ch = supabase
      .channel("alertas-mesero-banner")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "mesas" },
        () => refetch(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pedido_items" },
        () => refetch(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [refetch]);

  const misMesas = data?.mesas ?? [];
  const myId = data?.userId ?? null;

  const solicitudes = misMesas.filter((m) => !!m.solicitud_cliente);
  const listos = misMesas.filter((m) => m.alerta_listo);
  const asignaciones = misMesas.filter(
    (m) => !!m.asignada_at && m.id_mesero_asignado === myId,
  );

  // Empujar al bus
  useEffect(() => {
    for (const m of solicitudes) {
      const key = `sol:${m.id_mesa}:${m.solicitud_at ?? ""}`;
      bus.push({
        key,
        tipo: (m.solicitud_cliente ?? "LLAMADO") as AlertaItem["tipo"],
        idMesa: m.id_mesa,
      });
    }
  }, [solicitudes, bus]);

  useEffect(() => {
    for (const m of listos) {
      bus.push({ key: `listo:${m.id_mesa}`, tipo: "LISTO", idMesa: m.id_mesa });
    }
  }, [listos, bus]);

  useEffect(() => {
    for (const m of asignaciones) {
      bus.push({
        key: `asig:${m.id_mesa}:${m.asignada_at ?? ""}`,
        tipo: "ASIGNACION",
        idMesa: m.id_mesa,
      });
    }
  }, [asignaciones, bus]);

  const limpiarMut = useMutation({
    mutationFn: (idMesa: string) => limpiar({ data: { idMesa } }),
    onSuccess: () => {
      toast.success("Solicitud atendida");
      qc.invalidateQueries({ queryKey: ["servicio", "mesas"] });
    },
    onError: (e) =>
      toast.error("No se pudo limpiar", {
        description: e instanceof Error ? e.message : undefined,
      }),
  });

  // Render: unión de las tres fuentes, cada tarjeta con acción de confirmación
  type Card =
    | { kind: "sol"; mesa: MesaServicio; key: string }
    | { kind: "listo"; mesa: MesaServicio; key: string }
    | { kind: "asig"; mesa: MesaServicio; key: string };

  const cards: Card[] = [
    ...solicitudes.map<Card>((m) => ({
      kind: "sol",
      mesa: m,
      key: `sol:${m.id_mesa}:${m.solicitud_at ?? ""}`,
    })),
    ...listos.map<Card>((m) => ({
      kind: "listo",
      mesa: m,
      key: `listo:${m.id_mesa}`,
    })),
    ...asignaciones
      .filter((m) => {
        // Solo mostrar asignación si no hay otra alerta más específica en la mesa
        const otra = solicitudes.some((s) => s.id_mesa === m.id_mesa) ||
          listos.some((l) => l.id_mesa === m.id_mesa);
        return !otra;
      })
      .map<Card>((m) => ({
        kind: "asig",
        mesa: m,
        key: `asig:${m.id_mesa}:${m.asignada_at ?? ""}`,
      })),
  ];

  if (cards.length === 0) return null;

  return (
    <div className="sticky top-0 z-30 -mx-4 px-4 py-2 space-y-2 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b">
      {cards.map((c) => (
        <AlertaCard
          key={c.key}
          card={c}
          onIr={() =>
            nav({ to: "/servicio/$idMesa", params: { idMesa: c.mesa.id_mesa } })
          }
          onConfirmar={() => {
            if (c.kind === "sol") {
              limpiarMut.mutate(c.mesa.id_mesa);
            }
            bus.ack(c.key);
          }}
          confirmando={limpiarMut.isPending}
        />
      ))}
    </div>
  );
}

function AlertaCard({
  card,
  onIr,
  onConfirmar,
  confirmando,
}: {
  card:
    | { kind: "sol"; mesa: MesaServicio; key: string }
    | { kind: "listo"; mesa: MesaServicio; key: string }
    | { kind: "asig"; mesa: MesaServicio; key: string };
  onIr: () => void;
  onConfirmar: () => void;
  confirmando: boolean;
}) {
  const mesa = card.mesa;
  const tiempo = minsAgo(
    card.kind === "sol"
      ? mesa.solicitud_at
      : card.kind === "asig"
        ? mesa.asignada_at
        : null,
  );

  let styles = "";
  let icon = <Bell className="h-5 w-5" />;
  let titulo = "";
  let confirmarLabel = "Ya fui a la mesa";

  if (card.kind === "sol") {
    const tipo = mesa.solicitud_cliente ?? "";
    if (tipo === "LLAMADO") {
      styles = "border-destructive bg-destructive/10 text-destructive";
      icon = <Bell className="h-5 w-5 animate-pulse" />;
      titulo = `Mesa ${mesa.identificador} te está llamando`;
    } else if (tipo === "CUENTA") {
      styles = "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
      icon = <CreditCard className="h-5 w-5" />;
      titulo = `Mesa ${mesa.identificador} pide la cuenta`;
    } else if (tipo === "PEDIR_MAS") {
      styles = "border-primary bg-primary/10 text-primary";
      icon = <Plus className="h-5 w-5" />;
      titulo = `Mesa ${mesa.identificador} quiere pedir más`;
    } else if (tipo === "TOMAR_PEDIDO") {
      styles = "border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-300";
      icon = <ClipboardCheck className="h-5 w-5 animate-pulse" />;
      titulo = `Mesa ${mesa.identificador} terminó su pedido — ve a tomarlo`;
    }
    confirmarLabel = "Ya fui a la mesa";
  } else if (card.kind === "listo") {
    styles = "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
    icon = <PackageCheck className="h-5 w-5 animate-pulse" />;
    titulo = `Mesa ${mesa.identificador} — pedido listo para recoger`;
    confirmarLabel = "Ya lo entregué";
  } else {
    styles = "border-primary bg-primary/10 text-primary";
    icon = <UserPlus className="h-5 w-5 animate-pulse" />;
    titulo = `Mesa ${mesa.identificador} te fue asignada`;
    confirmarLabel = "Voy en camino";
  }

  return (
    <div className={`rounded-xl border-2 p-3 shadow-sm ${styles}`}>
      <div className="flex items-center gap-3">
        <div className="shrink-0">{icon}</div>
        <div className="min-w-0 flex-1">
          <p className="font-bold leading-tight">{titulo}</p>
          {card.kind !== "listo" && (
            <p className="text-xs opacity-80">Hace {tiempo} min</p>
          )}
        </div>
      </div>
      <div className="mt-2 flex gap-2">
        <Button size="sm" variant="outline" className="flex-1 gap-1" onClick={onIr}>
          Ver mesa <ArrowRight className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          className="flex-1 gap-1"
          onClick={onConfirmar}
          disabled={confirmando}
        >
          <Check className="h-4 w-4" /> {confirmarLabel}
        </Button>
      </div>
    </div>
  );
}
