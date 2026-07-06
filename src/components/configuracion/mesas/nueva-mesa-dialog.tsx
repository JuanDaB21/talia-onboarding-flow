import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { crearMesa } from "@/lib/mesas.functions";
import { mesaSchema, type MesaInput } from "@/lib/mesas-schemas";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  idNegocio: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

export function NuevaMesaDialog({ idNegocio, open, onOpenChange, onCreated }: Props) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<MesaInput>({
    resolver: zodResolver(mesaSchema),
    defaultValues: { identificador: "" },
  });

  const onSubmit = async (values: MesaInput) => {
    try {
      await crearMesa({ identificador: values.identificador });
    } catch (e) {
      toast.error("No se pudo crear la mesa", {
        description: e instanceof Error ? e.message : undefined,
      });
      return;
    }
    toast.success("Mesa creada");
    reset({ identificador: "" });
    onCreated();
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) reset({ identificador: "" });
      }}
    >
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Nueva mesa</DialogTitle>
          <DialogDescription>El QR se generará automáticamente al guardar.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="identificador">Identificador</Label>
            <Input
              id="identificador"
              placeholder="Ej. Azotea 1"
              autoFocus
              {...register("identificador")}
            />
            {errors.identificador && (
              <p className="text-xs text-destructive">{errors.identificador.message}</p>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" className="flex-1" disabled={isSubmitting}>
              {isSubmitting ? "Creando…" : "Crear mesa"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
