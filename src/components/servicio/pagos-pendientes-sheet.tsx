import { useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, ImageOff, Loader2, X } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { listarPagosPendientes, confirmarPago } from "@/lib/pagos.functions";
import { POLL, pollWhen } from "@/lib/query-config";

const fmt = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

export function PagosPendientesSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const qc = useQueryClient();
  const listar = useServerFn(listarPagosPendientes);
  const confFn = useServerFn(confirmarPago);

  const q = useQuery({
    queryKey: ["pagos", "pendientes"],
    queryFn: () => listar(),
    enabled: open,
    ...pollWhen(open, POLL.REALTIME),
  });

  useEffect(() => {
    if (!open) return;
    const ch = supabase
      .channel("pagos-pendientes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pagos" },
        () => qc.invalidateQueries({ queryKey: ["pagos", "pendientes"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [open, qc]);

  const mut = useMutation({
    mutationFn: (v: { idPago: string; aprobar: boolean }) => confFn({ data: v }),
    onSuccess: (_d, vars) => {
      toast.success(vars.aprobar ? "Pago aprobado" : "Pago rechazado");
      qc.invalidateQueries({ queryKey: ["pagos"] });
      qc.invalidateQueries({ queryKey: ["servicio"] });
    },
    onError: (e) =>
      toast.error("No se pudo actualizar", {
        description: e instanceof Error ? e.message : undefined,
      }),
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col">
        <SheetHeader className="px-5 pt-5 pb-3 border-b">
          <SheetTitle>Pagos por confirmar</SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {q.isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : !q.data?.esAdmin ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Solo administradores.
            </p>
          ) : q.data.pagos.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No hay pagos pendientes.
            </p>
          ) : (
            q.data.pagos.map((p) => (
              <article key={p.id_pago} className="rounded-xl border bg-card p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold">Mesa {p.identificador_mesa}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.mesero_nombre ?? "—"} ·{" "}
                      {new Date(p.created_at).toLocaleTimeString("es-CO", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  <Badge variant="secondary">{p.subtipo ?? "Transfer"}</Badge>
                </div>
                <p className="text-2xl font-bold tabular-nums text-primary">
                  {fmt.format(p.monto)}
                </p>
                {p.url_comprobante ? (
                  <a
                    href={p.url_comprobante}
                    target="_blank"
                    rel="noreferrer"
                    className="block rounded-lg overflow-hidden border bg-muted"
                  >
                    <img
                      src={p.url_comprobante}
                      alt="Comprobante"
                      className="w-full max-h-64 object-contain"
                    />
                  </a>
                ) : (
                  <div className="flex items-center gap-2 text-muted-foreground text-sm">
                    <ImageOff className="h-4 w-4" /> Sin comprobante
                  </div>
                )}
                <div className="flex gap-2 pt-1">
                  <Button
                    variant="outline"
                    className="flex-1"
                    disabled={mut.isPending}
                    onClick={() => mut.mutate({ idPago: p.id_pago, aprobar: false })}
                  >
                    <X className="h-4 w-4 mr-1" /> Rechazar
                  </Button>
                  <Button
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                    disabled={mut.isPending}
                    onClick={() => mut.mutate({ idPago: p.id_pago, aprobar: true })}
                  >
                    <Check className="h-4 w-4 mr-1" /> Aprobar
                  </Button>
                </div>
              </article>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
