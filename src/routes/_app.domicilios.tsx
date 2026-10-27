import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bike, ChevronDown, ExternalLink, Loader2, Settings, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { RoleGate } from "@/components/admin/role-gate";
import { useCurrentNegocio } from "@/hooks/use-current-negocio";
import { onResync, realtime } from "@/lib/realtime-client";
import { POLL } from "@/lib/query-config";
import { formatMoney } from "@/lib/format";
import { imprimirComandasDePedido } from "@/lib/comandas";
import {
  avanzarDomicilio,
  confirmarDomicilio,
  getDomicilio,
  listarDomicilios,
  type Domicilio,
} from "@/lib/domicilios.functions";
import { getNegocioConfig } from "@/lib/negocio.functions";
import { DomicilioCard, type AccionRapida } from "@/components/domicilios/domicilio-card";
import { DomicilioSheet } from "@/components/domicilios/domicilio-sheet";
import { aPedidoSesion, identificadorComanda } from "@/components/domicilios/domicilio-utils";

export const Route = createFileRoute("/_app/domicilios")({
  head: () => ({ meta: [{ title: "Domicilios — Talia" }] }),
  component: () => (
    <RoleGate roles={["ADMIN", "SUPERADMIN", "CAJERO"]}>
      <DomiciliosPage />
    </RoleGate>
  ),
});

const KEY = ["domicilios", "tablero"] as const;

const COLUMNAS: Array<{ key: Domicilio["estado"]; titulo: string; vacio: string }> = [
  {
    key: "PENDIENTE",
    titulo: "Sin confirmar",
    vacio: "Los pedidos nuevos de la carta llegan aquí.",
  },
  { key: "EN_PREPARACION", titulo: "En preparación", vacio: "Nada en cocina." },
  { key: "LISTO", titulo: "Listos", vacio: "Cuando cocina termine, aparecen aquí." },
  { key: "EN_CAMINO", titulo: "En camino", vacio: "Ningún domiciliario en ruta." },
];

/** Beep corto para pedidos nuevos (sin assets; WebAudio). */
function sonarAviso() {
  try {
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const tocar = (frec: number, t: number) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = frec;
      g.gain.setValueAtTime(0.0001, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.25);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + t);
      o.stop(ctx.currentTime + t + 0.3);
    };
    tocar(880, 0);
    tocar(1320, 0.18);
    setTimeout(() => void ctx.close(), 800);
  } catch {
    /* sin audio */
  }
}

function DomiciliosPage() {
  const qc = useQueryClient();
  const { idNegocio } = useCurrentNegocio();
  const [abiertoId, setAbiertoId] = useState<string | null>(null);
  const [verFinalizados, setVerFinalizados] = useState(false);
  const [ahora, setAhora] = useState(() => Date.now());

  const { data: domicilios = [], isLoading } = useQuery({
    queryKey: KEY,
    queryFn: listarDomicilios,
    // Red de seguridad por si se pierde un evento; lo normal es el parche por realtime.
    ...POLL.SLOW,
  });
  const { data: negocio } = useQuery({ queryKey: ["negocio-config"], queryFn: getNegocioConfig });

  useEffect(() => {
    const t = setInterval(() => setAhora(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  // ── Realtime incremental (P3): se trae SOLO el domicilio afectado y se parchea el cache. ──
  const parchear = useCallback(
    async (idDomicilio: string, nuevo = false) => {
      try {
        const d = await getDomicilio(idDomicilio);
        qc.setQueryData<Domicilio[]>(KEY, (prev = []) => {
          const i = prev.findIndex((x) => x.id_domicilio === d.id_domicilio);
          if (i === -1) return [...prev, d];
          const copia = prev.slice();
          copia[i] = d;
          return copia;
        });
        if (nuevo && d.estado === "PENDIENTE") {
          sonarAviso();
          toast(`Nuevo pedido ${d.codigo}`, {
            description: `${d.cliente_nombre} · ${d.tipo === "DOMICILIO" ? "domicilio" : "para recoger"} · ${formatMoney(d.total)}`,
          });
        }
      } catch {
        /* el polling lento lo corrige */
      }
    },
    [qc],
  );
  const parchearPorPedido = useCallback(
    (idPedido: string | undefined) => {
      if (!idPedido) return;
      const d = qc.getQueryData<Domicilio[]>(KEY)?.find((x) => x.id_pedido === idPedido);
      if (d) void parchear(d.id_domicilio);
    },
    [qc, parchear],
  );
  // Ráfagas de pedido_items (cocina marca varios ítems) → un solo fetch por pedido.
  const pendientes = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const parchearPedidoDebounced = useCallback(
    (idPedido: string | undefined) => {
      if (!idPedido) return;
      const m = pendientes.current;
      const t = m.get(idPedido);
      if (t) clearTimeout(t);
      m.set(
        idPedido,
        setTimeout(() => {
          m.delete(idPedido);
          parchearPorPedido(idPedido);
        }, 400),
      );
    },
    [parchearPorPedido],
  );

  useEffect(() => {
    const ch = realtime
      .channel("domicilios-tablero")
      .on("postgres_changes", { event: "*", schema: "public", table: "domicilios" }, (p) => {
        const fila = (p.new ?? p.old) as { id_domicilio?: string } | null;
        if (!fila?.id_domicilio) return;
        if (p.eventType === "DELETE") {
          qc.setQueryData<Domicilio[]>(KEY, (prev = []) =>
            prev.filter((x) => x.id_domicilio !== fila.id_domicilio),
          );
          return;
        }
        void parchear(fila.id_domicilio, p.eventType === "INSERT");
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "pedido_items" }, (p) => {
        const fila = (p.new ?? p.old) as { id_pedido?: string } | null;
        parchearPedidoDebounced(fila?.id_pedido);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "pagos" }, (p) => {
        const fila = (p.new ?? p.old) as { id_pedido?: string | null } | null;
        parchearPorPedido(fila?.id_pedido ?? undefined);
      })
      .subscribe();
    const alResync = () => void qc.invalidateQueries({ queryKey: KEY });
    onResync.addEventListener("resync", alResync);
    return () => {
      realtime.removeChannel(ch);
      onResync.removeEventListener("resync", alResync);
    };
  }, [qc, parchear, parchearPorPedido, parchearPedidoDebounced]);

  const invalidar = () => qc.invalidateQueries({ queryKey: KEY });

  const confirmar = useMutation({
    mutationFn: (d: Domicilio) => confirmarDomicilio(d.id_domicilio),
    onSuccess: (_r, d) => {
      toast.success(`${d.codigo} enviado a cocina`);
      imprimirComandasDePedido(
        identificadorComanda(d),
        `Cliente: ${d.cliente_nombre}`,
        aPedidoSesion(d),
      );
      void invalidar();
    },
    onError: (e) =>
      toast.error("No se pudo confirmar", {
        description: e instanceof Error ? e.message : undefined,
      }),
  });
  const avanzar = useMutation({
    mutationFn: (v: { d: Domicilio; estado: "EN_CAMINO" | "ENTREGADO" }) =>
      avanzarDomicilio({ idDomicilio: v.d.id_domicilio, estado: v.estado }),
    onSuccess: (_r, v) => {
      toast.success(
        v.estado === "EN_CAMINO" ? `${v.d.codigo} va en camino` : `${v.d.codigo} entregado`,
      );
      void invalidar();
    },
    onError: (e) =>
      toast.error("No se pudo actualizar", {
        description: e instanceof Error ? e.message : undefined,
      }),
  });

  const accionesDe = useCallback(
    (d: Domicilio): AccionRapida[] => {
      const pend = (id: string) =>
        (confirmar.isPending && confirmar.variables?.id_domicilio === id) ||
        (avanzar.isPending && avanzar.variables?.d.id_domicilio === id);
      const p = pend(d.id_domicilio);
      if (d.estado === "PENDIENTE")
        return [
          { label: "Confirmar y enviar a cocina", onClick: () => confirmar.mutate(d), pending: p },
        ];
      if (d.tipo === "DOMICILIO" && (d.estado === "EN_PREPARACION" || d.estado === "LISTO"))
        return [
          {
            label: "Despachar (en camino)",
            onClick: () => avanzar.mutate({ d, estado: "EN_CAMINO" }),
            pending: p,
          },
        ];
      if (d.tipo === "RECOGER" && (d.estado === "EN_PREPARACION" || d.estado === "LISTO"))
        return [
          {
            label: "Entregado al cliente",
            onClick: () => avanzar.mutate({ d, estado: "ENTREGADO" }),
            pending: p,
          },
        ];
      if (d.estado === "EN_CAMINO")
        return [
          {
            label: "Marcar entregado",
            onClick: () => avanzar.mutate({ d, estado: "ENTREGADO" }),
            pending: p,
          },
        ];
      return [];
    },
    [confirmar, avanzar],
  );

  const porColumna = useMemo(() => {
    const m = new Map<string, Domicilio[]>();
    for (const c of COLUMNAS) m.set(c.key, []);
    for (const d of domicilios) m.get(d.estado)?.push(d);
    return m;
  }, [domicilios]);
  const finalizados = useMemo(
    () =>
      domicilios
        .filter((d) => d.estado === "ENTREGADO" || d.estado === "CANCELADO")
        .sort((a, b) => b.updated_at.localeCompare(a.updated_at)),
    [domicilios],
  );
  const abierto = domicilios.find((d) => d.id_domicilio === abiertoId) ?? null;
  const sinConfigurar = negocio && !negocio.domicilios_activo && !negocio.recoger_activo;

  return (
    <div className="space-y-5 p-4 md:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Bike className="h-6 w-6 text-primary" /> Domicilios
          </h1>
          <p className="text-sm text-muted-foreground">
            Pedidos de la carta pública: confirma, despacha y cobra.
          </p>
        </div>
        <div className="flex gap-2">
          {idNegocio && (
            <Button variant="outline" size="sm" className="gap-1.5" asChild>
              <a href={`/carta-publica/${idNegocio}`} target="_blank" rel="noreferrer">
                <ExternalLink className="h-3.5 w-3.5" /> Ver carta
              </a>
            </Button>
          )}
          <Button variant="outline" size="sm" className="gap-1.5" asChild>
            <Link to="/configuracion/domicilios">
              <Settings className="h-3.5 w-3.5" /> Configurar
            </Link>
          </Button>
        </div>
      </header>

      {sinConfigurar && (
        <div className="rounded-xl border border-dashed p-4 text-sm">
          La carta aún no recibe pedidos.{" "}
          <Link to="/configuracion/domicilios" className="font-medium text-primary hover:underline">
            Activa domicilios o “para recoger”
          </Link>{" "}
          y agrega los municipios con su costo de envío.
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {COLUMNAS.map((c) => {
            const items = porColumna.get(c.key) ?? [];
            return (
              <section
                key={c.key}
                className="flex min-h-[200px] flex-col rounded-2xl bg-muted/40 p-3"
              >
                <div className="mb-3 flex items-center justify-between px-1">
                  <h2 className="text-sm font-semibold">{c.titulo}</h2>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${
                      c.key === "PENDIENTE" && items.length > 0
                        ? "bg-primary text-primary-foreground"
                        : "bg-background text-muted-foreground"
                    }`}
                  >
                    {items.length}
                  </span>
                </div>
                <div className="flex-1 space-y-3">
                  {items.length === 0 ? (
                    <p className="px-1 py-6 text-center text-xs text-muted-foreground">{c.vacio}</p>
                  ) : (
                    items.map((d) => (
                      <DomicilioCard
                        key={d.id_domicilio}
                        d={d}
                        ahora={ahora}
                        onOpen={() => setAbiertoId(d.id_domicilio)}
                        accion={accionesDe(d)[0] ?? null}
                      />
                    ))
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {finalizados.length > 0 && (
        <section className="rounded-2xl border">
          <button
            type="button"
            onClick={() => setVerFinalizados((v) => !v)}
            className="flex w-full items-center justify-between px-4 py-3 text-sm font-semibold"
          >
            Finalizados hoy ({finalizados.length})
            <ChevronDown
              className={`h-4 w-4 transition-transform ${verFinalizados ? "rotate-180" : ""}`}
            />
          </button>
          {verFinalizados && (
            <ul className="divide-y border-t">
              {finalizados.map((d) => (
                <li key={d.id_domicilio}>
                  <button
                    type="button"
                    onClick={() => setAbiertoId(d.id_domicilio)}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-muted/50"
                  >
                    {d.tipo === "DOMICILIO" ? (
                      <Bike className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ShoppingBag className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className="font-mono font-semibold">{d.codigo}</span>
                    <span className="min-w-0 flex-1 truncate text-muted-foreground">
                      {d.cliente_nombre}
                    </span>
                    <span
                      className={
                        d.estado === "CANCELADO" ? "text-destructive" : "text-muted-foreground"
                      }
                    >
                      {d.estado === "CANCELADO"
                        ? "Cancelado"
                        : d.pagado
                          ? "Entregado · pagado"
                          : "Entregado · por cobrar"}
                    </span>
                    <span className="tabular-nums">{formatMoney(d.total)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <DomicilioSheet
        d={abierto}
        open={!!abierto}
        onOpenChange={(o) => !o && setAbiertoId(null)}
        negocioNombre={negocio?.nombre_comercial ?? ""}
        acciones={abierto ? accionesDe(abierto) : []}
      />
    </div>
  );
}
