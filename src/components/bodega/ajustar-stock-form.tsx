import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useBodegas } from "@/hooks/use-bodegas";

interface Props {
  idInsumo: string;
  cantidadActual: number;
  unidadMedida: string;
  onSuccess: () => void;
  onCancel: () => void;
  idBodegaInicial?: string;
}

type Modo = "nueva" | "diff";

export function AjustarStockForm({
  idInsumo,
  cantidadActual,
  unidadMedida,
  onSuccess,
  onCancel,
  idBodegaInicial,
}: Props) {
  const { bodegas, loading: loadingBodegas } = useBodegas({ soloActivas: true });
  const [idBodega, setIdBodega] = useState<string>(idBodegaInicial ?? "");
  const [modo, setModo] = useState<Modo>("nueva");
  const [valor, setValor] = useState<string>("");
  const [motivo, setMotivo] = useState("");
  const [saving, setSaving] = useState(false);
  const [stockBodega, setStockBodega] = useState<number>(Number(cantidadActual) || 0);

  useEffect(() => {
    if (!idBodega && bodegas.length > 0) {
      setIdBodega(idBodegaInicial ?? bodegas[0].id_bodega);
    }
  }, [bodegas, idBodega, idBodegaInicial]);

  useEffect(() => {
    if (!idBodega) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("inventario_bodega")
        .select("cantidad_actual")
        .eq("id_insumo", idInsumo)
        .eq("id_bodega", idBodega)
        .maybeSingle();
      if (!cancelled) setStockBodega(Number(data?.cantidad_actual ?? 0));
    })();
    return () => {
      cancelled = true;
    };
  }, [idBodega, idInsumo]);

  const parsed = Number(valor);
  const valido = valor !== "" && !Number.isNaN(parsed);
  const nuevaCantidad = modo === "nueva" ? parsed : stockBodega + parsed;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!idBodega) {
      toast.error("Selecciona una bodega");
      return;
    }
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
      p_id_bodega: idBodega,
    } as never);
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
      <div className="space-y-1.5">
        <Label>Bodega</Label>
        <Select value={idBodega} onValueChange={setIdBodega} disabled={loadingBodegas}>
          <SelectTrigger>
            <SelectValue placeholder="Selecciona bodega" />
          </SelectTrigger>
          <SelectContent>
            {bodegas.map((b) => (
              <SelectItem key={b.id_bodega} value={b.id_bodega}>
                {b.nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
        Stock en esta bodega:{" "}
        <span className="font-semibold tabular-nums">
          {stockBodega.toLocaleString()} {unidadMedida}
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
