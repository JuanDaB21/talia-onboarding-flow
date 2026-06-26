import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  avanzarItem,
  iniciarComanda,
  listarComandasEstacion,
  type ComandaEstacion,
} from "@/lib/preparacion.functions";
import { ComandaCard } from "./comanda-card";
import { ComandaSheet } from "./comanda-sheet";
import { estadoComanda, type EstadoComanda } from "./comanda-utils";

const COLUMNAS: { key: EstadoComanda; label: string }[] = [
  { key: "EN_COLA", label: "En cola" },
  { key: "EN_PREPARACION", label: "En preparación" },
  { key: "LISTO", label: "Listo" },
  { key: "ENTREGADO", label: "Entregado (recientes)" },
];

interface Props {
  /** Slug del espacio de trabajo (e.g. "COCINA", "BARRA", "PLANCHA"). */
  destino: string;
  titulo: string;
}

export function KanbanBoard({ destino, titulo }: Props) {
  const listar = useServerFn(listarComandasEstacion);
  const avanzar = useServerFn(avanzarItem);
  const iniciar = useServerFn(iniciarComanda);
  const [comandas, setComandas] = useState<ComandaEstacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [iniciandoTodo, setIniciandoTodo] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const refrescar = useCallback(async () => {
    try {
      const res = await listar({ data: { destino } });
      setComandas(res.comandas);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error";
      toast.error("No se pudo cargar", { description: msg });
    } finally {
      setLoading(false);
    }
  }, [listar, destino]);

  useEffect(() => {
    refrescar();
    const channel = supabase
      .channel(`estacion-${destino}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "pedido_items" }, () => {
        refrescar();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "pedidos" }, () => {
        refrescar();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [refrescar, destino]);

  const handleAdvance = async (
    idItem: string,
    nuevoEstado: "EN_PREPARACION" | "LISTO",
  ) => {
    setBusyId(idItem);
    try {
      await avanzar({ data: { idItem, nuevoEstado } });
      await refrescar();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error";
      toast.error("No se pudo avanzar", { description: msg });
    } finally {
      setBusyId(null);
    }
  };

  const handleIniciarTodo = async (idPedido: string) => {
    setIniciandoTodo(true);
    try {
      const res = await iniciar({ data: { idPedido, destino } });
      toast.success(`${res.iniciados} item${res.iniciados === 1 ? "" : "s"} en preparación`);
      await refrescar();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error";
      toast.error("No se pudo iniciar", { description: msg });
    } finally {
      setIniciandoTodo(false);
    }
  };

  const grupos = useMemo(() => {
    const m = new Map<EstadoComanda, ComandaEstacion[]>();
    COLUMNAS.forEach((c) => m.set(c.key, []));
    comandas.forEach((c) => {
      const e = estadoComanda(c.items);
      m.get(e)?.push(c);
    });
    return m;
  }, [comandas]);

  const totalActivas = comandas.filter((c) => estadoComanda(c.items) !== "ENTREGADO").length;
  const comandaAbierta = comandas.find((c) => c.id_pedido === openId) ?? null;

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{titulo}</h1>
          <p className="text-sm text-muted-foreground">
            {loading
              ? "Cargando…"
              : `${totalActivas} comanda${totalActivas === 1 ? "" : "s"} activa${totalActivas === 1 ? "" : "s"}`}
          </p>
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {COLUMNAS.map((col) => {
          const lista = grupos.get(col.key) ?? [];
          return (
            <section
              key={col.key}
              className="rounded-lg border bg-muted/30 p-3 space-y-2 min-h-[200px]"
            >
              <header className="flex items-center justify-between">
                <h2 className="text-sm font-semibold">{col.label}</h2>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {lista.length}
                </span>
              </header>
              <div className="space-y-2">
                {lista.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-6">
                    Sin comandas
                  </p>
                ) : (
                  lista.map((c) => (
                    <ComandaCard
                      key={c.id_pedido}
                      comanda={c}
                      onOpen={() => setOpenId(c.id_pedido)}
                    />
                  ))
                )}
              </div>
            </section>
          );
        })}
      </div>

      <ComandaSheet
        comanda={comandaAbierta}
        destino={destino}
        open={openId !== null && comandaAbierta !== null}
        onOpenChange={(o) => !o && setOpenId(null)}
        onAdvance={handleAdvance}
        onIniciarTodo={() =>
          comandaAbierta ? handleIniciarTodo(comandaAbierta.id_pedido) : Promise.resolve()
        }
        busyId={busyId}
        iniciandoTodo={iniciandoTodo}
      />
    </div>
  );
}
