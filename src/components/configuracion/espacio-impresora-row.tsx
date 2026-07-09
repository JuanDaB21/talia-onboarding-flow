import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Printer } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getImpresionConfigs, guardarImpresionConfig } from "@/lib/impresion.functions";

interface Props {
  id_espacio: string;
  slug: string;
  nombre: string;
}

// Code pages comunes en térmicas ESC/POS. CP850/CP858 imprimen tildes y ñ (español).
const CODEPAGES: { value: string; label: string }[] = [
  { value: "CP850", label: "CP850 (Latín, recomendado)" },
  { value: "CP858", label: "CP858 (Latín + €)" },
  { value: "CP437", label: "CP437 (sin acentos)" },
  { value: "CP1252", label: "CP1252 (Windows Latín)" },
];

/**
 * Config de impresión de un espacio (ancho + code page). La impresora FÍSICA ya no
 * se vincula por el navegador (WebUSB): se asigna en el print-agent local usando el
 * SLUG de este espacio. El ancho/code page viajan en cada comanda encolada.
 */
export function EspacioImpresoraRow({ id_espacio, slug }: Props) {
  const [ancho, setAncho] = useState<number>(80);
  const [codepage, setCodepage] = useState<string>("CP850");

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const cfgs = await getImpresionConfigs();
        if (cancel) return;
        const cfg = cfgs.find((c) => c.id_espacio === id_espacio);
        if (cfg?.ancho_papel_mm) setAncho(Number(cfg.ancho_papel_mm));
        if (cfg?.codepage) setCodepage(cfg.codepage);
      } catch {
        /* sin config aún: se quedan los defaults */
      }
    })();
    return () => {
      cancel = true;
    };
  }, [id_espacio]);

  const guardar = async (next: { ancho?: number; codepage?: string }) => {
    const nextAncho = next.ancho ?? ancho;
    const nextCp = next.codepage ?? codepage;
    setAncho(nextAncho);
    setCodepage(nextCp);
    try {
      await guardarImpresionConfig({
        id_espacio,
        ancho_papel_mm: nextAncho as 58 | 80,
        codepage: nextCp,
      });
    } catch (e) {
      toast.error("No se pudo guardar la configuración", {
        description: e instanceof Error ? e.message : undefined,
      });
    }
  };

  return (
    <div className="pt-2 border-t space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <Printer className="h-4 w-4 text-muted-foreground shrink-0" />
        <Label className="text-xs text-muted-foreground shrink-0">Impresora (print-agent)</Label>
        <Badge variant="outline" className="text-xs font-mono">
          {slug.toUpperCase()}
        </Badge>
      </div>

      <p className="text-[11px] text-muted-foreground pl-6">
        Asigna la impresora física a este espacio en el print-agent, usando el slug{" "}
        <span className="font-mono">{slug.toUpperCase()}</span>.
      </p>

      <div className="flex items-center gap-3 pl-6 flex-wrap">
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground shrink-0">Papel</Label>
          <Select value={String(ancho)} onValueChange={(v) => guardar({ ancho: Number(v) })}>
            <SelectTrigger className="h-7 text-xs w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="80">80 mm</SelectItem>
              <SelectItem value="58">58 mm</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground shrink-0">Code page</Label>
          <Select value={codepage} onValueChange={(v) => guardar({ codepage: v })}>
            <SelectTrigger className="h-7 text-xs w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CODEPAGES.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
