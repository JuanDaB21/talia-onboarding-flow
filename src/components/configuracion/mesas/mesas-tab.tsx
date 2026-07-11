import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { realtime } from "@/lib/realtime-client";
import { listarMesas, ordenarMesas } from "@/lib/mesas.functions";
import { Button } from "@/components/ui/button";
import type { Mesa } from "@/lib/mesas-schemas";
import { MesaCard } from "./mesa-card";
import { MesaDetailDialog } from "./mesa-detail-dialog";
import { NuevaMesaDialog } from "./nueva-mesa-dialog";

export function MesasTab({ idNegocio }: { idNegocio: string }) {
  const [items, setItems] = useState<Mesa[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Mesa | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [newOpen, setNewOpen] = useState(false);

  const load = async () => {
    const data = await listarMesas();
    setItems(ordenarMesas(data ?? []));
    setLoading(false);
  };

  useEffect(() => {
    load();
    const channel = realtime
      .channel(`mesas-${idNegocio}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "mesas" }, () => load())
      .subscribe();
    return () => {
      realtime.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idNegocio]);

  const openDetail = (m: Mesa) => {
    setSelected(m);
    setDetailOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setNewOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> Nueva mesa
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : items.length === 0 ? (
        <div className="rounded-md border border-dashed p-10 text-center">
          <p className="text-sm text-muted-foreground">
            Aún no tienes mesas. Crea la primera para empezar.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {items.map((m) => (
            <MesaCard key={m.id_mesa} mesa={m} onClick={() => openDetail(m)} />
          ))}
        </div>
      )}

      <MesaDetailDialog
        mesa={selected}
        open={detailOpen}
        onOpenChange={(o) => {
          setDetailOpen(o);
          if (!o) setSelected(null);
        }}
        onChanged={load}
      />
      <NuevaMesaDialog
        idNegocio={idNegocio}
        open={newOpen}
        onOpenChange={setNewOpen}
        onCreated={load}
      />
    </div>
  );
}
