import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  avanzarItem,
  listarItemsEstacion,
  type ItemPreparacion,
} from "@/lib/preparacion.functions";
import { ItemCard } from "./item-card";

const COLUMNAS: { key: string; label: string }[] = [
  { key: "EN_COLA", label: "En cola" },
  { key: "EN_PREPARACION", label: "En preparación" },
  { key: "LISTO", label: "Listo" },
  { key: "ENTREGADO", label: "Entregado (recientes)" },
];

interface Props {
  destino: "COCINA" | "BARRA";
  titulo: string;
}

export function KanbanBoard({ destino, titulo }: Props) {
  const listar = useServerFn(listarItemsEstacion);
  const avanzar = useServerFn(avanzarItem);
  const [items, setItems] = useState<ItemPreparacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refrescar = useCallback(async () => {
    try {
      const res = await listar({ data: { destino } });
      setItems(res.items);
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
    id: string,
    nuevoEstado: "EN_PREPARACION" | "LISTO" | "ENTREGADO",
  ) => {
    setBusyId(id);
    try {
      await avanzar({ data: { idItem: id, nuevoEstado } });
      await refrescar();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error";
      toast.error("No se pudo avanzar", { description: msg });
    } finally {
      setBusyId(null);
    }
  };

  // Para ENTREGADO mostramos los últimos 10 (en este filtro listar ya excluye ENTREGADO,
  // así que esa columna queda vacía. La mostramos para feedback visual del flujo.)
  const grupos = new Map<string, ItemPreparacion[]>();
  COLUMNAS.forEach((c) => grupos.set(c.key, []));
  items.forEach((i) => {
    const arr = grupos.get(i.estado_preparacion);
    if (arr) arr.push(i);
  });

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{titulo}</h1>
          <p className="text-sm text-muted-foreground">
            {loading ? "Cargando…" : `${items.length} item${items.length === 1 ? "" : "s"} activo${items.length === 1 ? "" : "s"}`}
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
                <span className="text-xs text-muted-foreground tabular-nums">{lista.length}</span>
              </header>
              <div className="space-y-2">
                {lista.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-6">Sin items</p>
                ) : (
                  lista.map((it) => (
                    <ItemCard
                      key={it.id_item}
                      item={it}
                      busy={busyId === it.id_item}
                      onAdvance={(ne) => handleAdvance(it.id_item, ne)}
                    />
                  ))
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
