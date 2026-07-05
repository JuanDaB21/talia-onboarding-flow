import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  listarMeserosNegocio,
  abrirMesa,
} from "@/lib/servicio.functions";

export function AbrirMesaDialog({
  open,
  onOpenChange,
  idMesa,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  idMesa: string;
}) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [sel, setSel] = useState<string>("");

  const meserosQ = useQuery({
    queryKey: ["meseros-negocio"],
    queryFn: () => listarMeserosNegocio(),
    enabled: open,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (open) setSel("");
  }, [open]);

  const mut = useMutation({
    mutationFn: (idMesero: string) => abrirMesa({ idMesa, idMesero }),
    onSuccess: () => {
      toast.success("Mesa abierta");
      qc.invalidateQueries({ queryKey: ["servicio", "mesas"] });
      qc.invalidateQueries({ queryKey: ["mesaSesion", idMesa] });
      qc.invalidateQueries({ queryKey: ["mesasServicio"] });
      onOpenChange(false);
      navigate({ to: "/servicio/$idMesa", params: { idMesa } });
    },
    onError: (e) =>
      toast.error("No se pudo abrir la mesa", {
        description: e instanceof Error ? e.message : undefined,
      }),
  });

  const meseros = meserosQ.data ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Abrir mesa</DialogTitle>
          <DialogDescription>
            Selecciona el mesero que la atenderá.
          </DialogDescription>
        </DialogHeader>
        {meserosQ.isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : meseros.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">
            No hay meseros activos disponibles.
          </p>
        ) : (
          <Select value={sel} onValueChange={setSel}>
            <SelectTrigger>
              <SelectValue placeholder="Selecciona un mesero" />
            </SelectTrigger>
            <SelectContent>
              {meseros.map((m) => (
                <SelectItem key={m.id_usuario} value={m.id_usuario}>
                  {m.nombre}
                  {m.esta_en_turno ? "" : " (fuera de turno)"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={mut.isPending}
          >
            Cancelar
          </Button>
          <Button
            onClick={() => sel && mut.mutate(sel)}
            disabled={!sel || mut.isPending}
          >
            {mut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Abrir mesa
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
