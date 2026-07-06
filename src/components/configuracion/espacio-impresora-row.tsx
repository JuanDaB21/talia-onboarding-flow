import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Printer, PrinterCheck, X, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getImpresionConfigs, guardarImpresionAncho } from "@/lib/impresion.functions";
import {
  getPairedPrinter,
  isWebUSBSupported,
  requestAndPairPrinter,
  printPruebaOnPairedPrinter,
  subscribePairing,
  unpairPrinter,
  type PairedPrinter,
} from "@/services/usbPrinter";

interface Props {
  id_espacio: string;
  slug: string;
  nombre: string;
}

export function EspacioImpresoraRow({ id_espacio, slug, nombre }: Props) {
  const [paired, setPaired] = useState<PairedPrinter | null>(() => getPairedPrinter(slug));
  const [ancho, setAncho] = useState<number>(80);
  const [busy, setBusy] = useState(false);
  const supported = isWebUSBSupported();

  const refresh = useCallback(() => {
    setPaired(getPairedPrinter(slug));
  }, [slug]);

  useEffect(() => subscribePairing(refresh), [refresh]);
  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const cfgs = await getImpresionConfigs();
        if (cancel) return;
        const cfg = cfgs.find((c) => c.id_espacio === id_espacio);
        if (cfg?.ancho_papel_mm) setAncho(Number(cfg.ancho_papel_mm));
      } catch {
        /* sin config aún: se queda en el default 80 */
      }
    })();
    return () => {
      cancel = true;
    };
  }, [id_espacio]);

  const updateAncho = async (v: number) => {
    setAncho(v);
    try {
      await guardarImpresionAncho({ id_espacio, ancho_papel_mm: v as 58 | 80 });
    } catch (e) {
      toast.error("No se pudo guardar el ancho", {
        description: e instanceof Error ? e.message : undefined,
      });
    }
  };

  const handlePair = async () => {
    if (!supported) {
      toast.error("Este navegador no soporta impresión USB", {
        description: "Usa Chrome, Edge u Opera de escritorio.",
      });
      return;
    }
    setBusy(true);
    try {
      const p = await requestAndPairPrinter(slug);
      setPaired(p);
      toast.success(`Impresora vinculada a ${nombre}`, {
        description: p.productName ?? `${p.vendorId.toString(16)}:${p.productId.toString(16)}`,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error";
      if (!msg.toLowerCase().includes("no device selected")) {
        toast.error("No se pudo vincular", { description: msg });
      }
    } finally {
      setBusy(false);
    }
  };

  const handleTest = async () => {
    setBusy(true);
    try {
      const out = await printPruebaOnPairedPrinter(slug, ancho);
      if (out.ok) toast.success("Prueba enviada a la impresora");
      else toast.error("No se pudo imprimir la prueba", { description: out.error });
    } finally {
      setBusy(false);
    }
  };

  const handleUnpair = () => {
    unpairPrinter(slug);
    setPaired(null);
    toast.success("Impresora desvinculada");
  };

  return (
    <div className="pt-2 border-t space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <Printer className="h-4 w-4 text-muted-foreground shrink-0" />
        <Label className="text-xs text-muted-foreground shrink-0">Impresora local</Label>
        {paired ? (
          <Badge variant="secondary" className="text-xs gap-1">
            <PrinterCheck className="h-3 w-3" /> Vinculada
          </Badge>
        ) : (
          <Badge variant="outline" className="text-xs">
            Sin vincular
          </Badge>
        )}
        <div className="flex-1" />
        {paired && (
          <Button size="sm" variant="ghost" onClick={handleTest} disabled={busy}>
            <Zap className="h-3.5 w-3.5 mr-1" /> Probar
          </Button>
        )}
        <Button
          size="sm"
          variant={paired ? "outline" : "default"}
          onClick={handlePair}
          disabled={busy || !supported}
        >
          {paired ? "Cambiar" : "Vincular"}
        </Button>
        {paired && (
          <Button size="icon" variant="ghost" onClick={handleUnpair} aria-label="Quitar impresora">
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {paired && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground pl-6">
          <span className="truncate">
            {paired.productName ?? "Impresora térmica"}
            {paired.manufacturerName ? ` · ${paired.manufacturerName}` : ""}
          </span>
        </div>
      )}

      <div className="flex items-center gap-2 pl-6">
        <Label className="text-xs text-muted-foreground shrink-0">Papel</Label>
        <Select value={String(ancho)} onValueChange={(v) => updateAncho(Number(v))}>
          <SelectTrigger className="h-7 text-xs w-24">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="80">80 mm</SelectItem>
            <SelectItem value="58">58 mm</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {!supported && (
        <p className="text-[11px] text-muted-foreground pl-6">
          Este navegador no soporta impresión USB directa. Usa Chrome, Edge u Opera de escritorio en
          el PC donde esté conectada la térmica.
        </p>
      )}
    </div>
  );
}
