import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

interface Props {
  idInsumo: string;
  cantidadActual: number;
  unidadMedida: string;
  onSuccess: () => void;
  onCancel: () => void;
}

type Modo = "nueva" | "diff";

export function AjustarStockForm({
  idInsumo,
  cantidadActual,
  unidadMedida,
  onSuccess,
  onCancel,
}: Props) {
  const [modo, setModo] = useState<Modo>("nueva");
  const [valor, setValor] = useState<string>("");
  const [motivo, setMotivo] = useState("");
  const [saving, setSaving] = useState(false);

  const parsed = Number(valor);
  const valido = valor !== "" && !Number.isNaN(parsed);
  const nuevaCantidad =
    modo === "nueva" ? parsed : Number(cantidadActual) + parsed;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valido) {
      toast.error("Ingresa un número válido");
      return;
    }
    if (nuevaCantidad < 0) {
      toast.error("La cantidad final no puede ser negativa");
      return;
    }
    if (!motivo.trim()) {
      toast.error("Indica un motivo");
      return;
    }
    setSaving(true);
    const { error } = await supabase.rpc("ajustar_stock_manual", {
      p_id_insumo: idInsumo,
      p_nueva_cantidad: nuevaCantidad,
      p_motivo: motivo.trim(),
    });
    setSaving(false);
    if (error) {
      toast.error("No se pudo ajustar el stock", { description: error.message });
      return;
    }
    toast.success("Stock actualizado");
    onSuccess();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
        Stock actual:{" "}
        <span className="font-semibold tabular-nums">
          {Number(cantidadActual).toLocaleString()} {unidadMedida}
        </span>
      </div>

      <div className="space-y-2">
        <Label>Modo de ajuste</Label>
        <RadioGroup value={modo} onValueChange={(v) => setModo(v as Modo)}>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="nueva" id="m-nueva" />
            <Label htmlFor="m-nueva" className="font-normal cursor-pointer">
              Nueva cantidad (reemplaza el valor)
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="diff" id="m-diff" />
            <Label htmlFor="m-diff" className="font-normal cursor-pointer">
              Diferencial (suma o resta)
            </Label>
          </div>
        </RadioGroup>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="valor">
          {modo === "nueva" ? "Nueva cantidad" : "Diferencial (+/-)"}
        </Label>
        <Input
          id="valor"
          type="number"
          step="0.0001"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          placeholder={modo === "nueva" ? "0" : "+10 / -5"}
        />
        {valido && (
          <p className="text-xs text-muted-foreground">
            Resultado:{" "}
            <span className="font-semibold tabular-nums">
              {nuevaCantidad.toLocaleString()} {unidadMedida}
            </span>
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="motivo">Motivo</Label>
        <Textarea
          id="motivo"
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder="Conteo físico, merma, corrección…"
          rows={3}
        />
      </div>

      <div className="flex flex-col sm:flex-row gap-2 pt-2">
        <Button type="button" variant="outline" className="w-full sm:flex-1" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" className="w-full sm:flex-1" disabled={saving}>
          {saving ? "Guardando…" : "Aplicar ajuste"}
        </Button>
      </div>
    </form>
  );
}
