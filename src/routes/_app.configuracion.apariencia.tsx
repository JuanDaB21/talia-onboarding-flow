import { useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ImageIcon, Loader2, Trash2, Upload, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { listarMesas } from "@/lib/mesas.functions";
import { publicUrl, uploadToStorage } from "@/lib/storage";
import { getNegocioConfig, updateNegocioApariencia } from "@/lib/negocio.functions";
import { MENU_THEMES, MENU_THEME_IDS, type MenuThemeId } from "@/lib/menu-themes";
import { AdminGate } from "@/components/admin/admin-gate";

export const Route = createFileRoute("/_app/configuracion/apariencia")({
  head: () => ({ meta: [{ title: "Menú público — Talia" }] }),
  component: () => (
    <AdminGate>
      <AparienciaPage />
    </AdminGate>
  ),
});

function AparienciaPage() {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["negocio-config"],
    queryFn: () => getNegocioConfig(),
  });

  const mut = useMutation({
    mutationFn: (patch: { tema_menu?: MenuThemeId; url_logo?: string | null }) =>
      updateNegocioApariencia(patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["negocio-config"] });
    },
    onError: (e) => {
      toast.error("No se pudo guardar", {
        description: e instanceof Error ? e.message : undefined,
      });
    },
  });

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  if (isLoading || !data) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const handleSelectTheme = (id: MenuThemeId) => {
    if (id === data.tema_menu) return;
    mut.mutate(
      { tema_menu: id },
      { onSuccess: () => toast.success(`Tema "${MENU_THEMES[id].nombre}" aplicado`) },
    );
  };

  const openPreview = async () => {
    let mesa: { id_mesa: string } | undefined;
    try {
      const mesas = await listarMesas();
      mesa = mesas[0];
    } catch (e) {
      toast.error("No se pudo abrir la vista previa", {
        description: e instanceof Error ? e.message : undefined,
      });
      return;
    }
    if (!mesa) {
      toast.info("Crea al menos una mesa para abrir la vista previa");
      return;
    }
    window.open(`/carta/${mesa.id_mesa}`, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="container mx-auto max-w-6xl px-4 py-6 space-y-6">
      <header className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Apariencia del menú público</h1>
          <p className="text-sm text-muted-foreground">
            Personaliza el logo y el tema que verán tus clientes al escanear la mesa.
          </p>
        </div>
        <Button variant="outline" onClick={openPreview} className="gap-2">
          <ExternalLink className="h-4 w-4" />
          Ver vista previa
        </Button>
      </header>

      <LogoCard
        urlLogo={data.url_logo}
        idNegocio={data.id_negocio}
        onUpload={(url) =>
          mut.mutate({ url_logo: url }, { onSuccess: () => toast.success("Logo actualizado") })
        }
        onRemove={() =>
          mut.mutate({ url_logo: null }, { onSuccess: () => toast.success("Logo eliminado") })
        }
      />

      <section>
        <h2 className="text-lg font-semibold mb-3">Tema del menú</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {MENU_THEME_IDS.map((id) => (
            <ThemePreviewCard
              key={id}
              themeId={id}
              selected={data.tema_menu === id}
              loading={mut.isPending && previewUrl === id}
              onSelect={() => {
                setPreviewUrl(id);
                handleSelectTheme(id);
              }}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

function LogoCard({
  urlLogo,
  idNegocio,
  onUpload,
  onRemove,
}: {
  urlLogo: string | null;
  idNegocio: string;
  onUpload: (url: string) => void;
  onRemove: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (file: File) => {
    if (file.size > 2 * 1024 * 1024) {
      toast.error("El archivo no puede superar 2MB");
      return;
    }
    const allowed = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
    if (!allowed.includes(file.type)) {
      toast.error("Formato no soportado", { description: "Usa PNG, JPG, WEBP o SVG." });
      return;
    }
    setUploading(true);
    try {
      const { path } = await uploadToStorage("logo", file);
      onUpload(path);
    } catch (e) {
      toast.error("No se pudo subir el logo", {
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <Card className="p-5">
      <div className="flex flex-col sm:flex-row sm:items-center gap-5">
        <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-muted">
          {urlLogo ? (
            <img
              src={publicUrl(urlLogo) ?? undefined}
              alt="Logo"
              className="h-full w-full object-contain"
            />
          ) : (
            <ImageIcon className="h-8 w-8 text-muted-foreground" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold">Logo del negocio</h2>
          <p className="text-sm text-muted-foreground">
            Aparece arriba a la derecha del menú público. Recomendado cuadrado, PNG o SVG con fondo
            transparente. Máx 2MB.
          </p>
        </div>
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />
          <Button
            variant="outline"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="gap-2"
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            {urlLogo ? "Cambiar" : "Subir logo"}
          </Button>
          {urlLogo && (
            <Button
              variant="ghost"
              onClick={onRemove}
              disabled={uploading}
              className="gap-2 text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
              Quitar
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

function ThemePreviewCard({
  themeId,
  selected,
  loading,
  onSelect,
}: {
  themeId: MenuThemeId;
  selected: boolean;
  loading: boolean;
  onSelect: () => void;
}) {
  const theme = MENU_THEMES[themeId];
  const style = theme.vars as unknown as React.CSSProperties;
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`group relative overflow-hidden rounded-xl border-2 text-left transition-all hover:shadow-lg ${
        selected ? "border-primary ring-2 ring-primary/30" : "border-border hover:border-primary/40"
      }`}
    >
      {selected && (
        <div className="absolute right-3 top-3 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground shadow">
          <Check className="h-4 w-4" />
        </div>
      )}
      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      )}
      <div style={style} className="aspect-[4/3] p-3">
        <div
          className="h-full w-full overflow-hidden flex flex-col"
          style={{
            background: "var(--menu-bg)",
            color: "var(--menu-foreground)",
            fontFamily: "var(--menu-body-font)",
            borderRadius: "var(--menu-radius)",
          }}
        >
          <MiniHeader theme={theme} />
          <MiniCategories theme={theme} />
          <div className="flex-1 px-2.5 pb-2.5 overflow-hidden">
            <MiniProducts theme={theme} />
          </div>
        </div>
      </div>
      <div className="border-t bg-card px-3 py-2">
        <div className="font-semibold text-sm">{theme.nombre}</div>
        <div className="text-xs text-muted-foreground line-clamp-1">{theme.descripcion}</div>
      </div>
    </button>
  );
}

function MiniHeader({ theme }: { theme: (typeof MENU_THEMES)[MenuThemeId] }) {
  const s = theme.headerStyle;
  if (s === "hero-centrado") {
    return (
      <div
        className="px-2 py-2 text-center"
        style={{
          background: theme.vars["--menu-gradient"] ?? "var(--menu-surface)",
        }}
      >
        <div
          className="text-[9px] uppercase tracking-widest"
          style={{ color: "var(--menu-accent)" }}
        >
          Mesa 12
        </div>
        <div
          className="text-[12px] font-bold leading-tight"
          style={{ fontFamily: "var(--menu-heading-font)" }}
        >
          La Trattoria
        </div>
        <div className="mx-auto mt-0.5 h-px w-6" style={{ background: "var(--menu-accent)" }} />
      </div>
    );
  }
  if (s === "banner-gradiente") {
    return (
      <div
        className="px-2 py-2"
        style={{
          background: theme.vars["--menu-gradient"] ?? "var(--menu-primary)",
          color: "var(--menu-primary-foreground)",
        }}
      >
        <div className="text-[8px] uppercase tracking-widest opacity-80">Mesa 12</div>
        <div
          className="text-[12px] font-bold leading-tight"
          style={{ fontFamily: "var(--menu-heading-font)" }}
        >
          La Trattoria
        </div>
      </div>
    );
  }
  if (s === "editorial") {
    return (
      <div
        className="px-2 py-1.5"
        style={{
          background: "var(--menu-surface)",
          borderBottom: "1px solid var(--menu-border)",
        }}
      >
        <div className="text-[8px] tracking-widest" style={{ color: "var(--menu-accent)" }}>
          · MESA 12 ·
        </div>
        <div
          className="text-[13px] font-bold italic leading-tight"
          style={{ fontFamily: "var(--menu-heading-font)" }}
        >
          La Trattoria
        </div>
        <div className="mt-1 flex items-center gap-1">
          <div className="h-px flex-1" style={{ background: "var(--menu-border)" }} />
          <div className="text-[7px] tracking-widest" style={{ color: "var(--menu-muted)" }}>
            CARTA
          </div>
          <div className="h-px flex-1" style={{ background: "var(--menu-border)" }} />
        </div>
      </div>
    );
  }
  // minimal
  return (
    <div
      className="flex items-center justify-between px-2 py-1.5"
      style={{
        background: "var(--menu-surface)",
        borderBottom: "1px solid var(--menu-border)",
      }}
    >
      <div>
        <div className="text-[8px] uppercase tracking-wider" style={{ color: "var(--menu-muted)" }}>
          Mesa 12
        </div>
        <div className="text-[11px] font-bold" style={{ fontFamily: "var(--menu-heading-font)" }}>
          La Trattoria
        </div>
      </div>
      <div className="h-4 w-4 rounded-full" style={{ background: "var(--menu-primary)" }} />
    </div>
  );
}

function MiniCategories({ theme }: { theme: (typeof MENU_THEMES)[MenuThemeId] }) {
  const s = theme.categoryStyle;
  const items = ["Todo", "Entradas", "Platos"];
  if (s === "tabs-subrayadas") {
    return (
      <div className="flex gap-2 px-2 py-1.5">
        {items.map((it, i) => (
          <div
            key={it}
            className="text-[9px] pb-0.5"
            style={{
              color: i === 0 ? "var(--menu-foreground)" : "var(--menu-muted)",
              borderBottom: i === 0 ? "1.5px solid var(--menu-accent)" : "1.5px solid transparent",
            }}
          >
            {it}
          </div>
        ))}
      </div>
    );
  }
  if (s === "tags-duros") {
    return (
      <div className="flex gap-1 px-2 py-1.5">
        {items.map((it, i) => (
          <div
            key={it}
            className="text-[8px] font-bold uppercase px-1.5 py-0.5"
            style={{
              background: i === 0 ? "var(--menu-foreground)" : "var(--menu-surface)",
              color: i === 0 ? "var(--menu-bg)" : "var(--menu-foreground)",
              border: "1.5px solid var(--menu-foreground)",
            }}
          >
            {it}
          </div>
        ))}
      </div>
    );
  }
  // pills & chips-grandes
  return (
    <div className="flex gap-1 px-2 py-1.5">
      {items.map((it, i) => (
        <div
          key={it}
          className="text-[9px] px-2 py-0.5 rounded-full"
          style={{
            background:
              i === 0
                ? (theme.vars["--menu-gradient"] ?? "var(--menu-primary)")
                : "var(--menu-surface)",
            color: i === 0 ? "var(--menu-primary-foreground)" : "var(--menu-foreground)",
            border: i === 0 ? "none" : "1px solid var(--menu-border)",
            fontWeight: s === "chips-grandes" ? 600 : 500,
          }}
        >
          {it}
        </div>
      ))}
    </div>
  );
}

function MiniProducts({ theme }: { theme: (typeof MENU_THEMES)[MenuThemeId] }) {
  const layout = theme.productLayout;
  const priceStyle: React.CSSProperties =
    theme.priceStyle === "tag"
      ? {
          background: "var(--menu-accent)",
          color: "var(--menu-primary-foreground)",
          padding: "1px 5px",
          borderRadius: "3px",
        }
      : theme.priceStyle === "badge-gradiente"
        ? {
            background: theme.vars["--menu-gradient"] ?? "var(--menu-primary)",
            color: "var(--menu-primary-foreground)",
            padding: "1px 6px",
            borderRadius: "9999px",
          }
        : theme.priceStyle === "linea"
          ? { color: "var(--menu-accent)" }
          : theme.priceStyle === "subrayado"
            ? {
                color: "var(--menu-accent)",
                borderBottom: "1.5px solid var(--menu-accent)",
              }
            : { color: "var(--menu-foreground)" };

  const Price = () => (
    <span className="text-[9px] font-bold tabular-nums" style={priceStyle}>
      $25K
    </span>
  );

  if (layout === "hero-grid") {
    return (
      <div className="grid grid-cols-2 gap-1.5 h-full">
        {[0, 1].map((i) => (
          <div
            key={i}
            className="overflow-hidden flex flex-col"
            style={{
              background: "var(--menu-surface)",
              border: "1px solid var(--menu-border)",
              borderRadius: "calc(var(--menu-radius) / 2)",
            }}
          >
            <div className="flex-1" style={{ background: "var(--menu-surface-2)" }} />
            <div className="p-1 space-y-0.5">
              <div
                className="h-1.5 w-3/4 rounded"
                style={{ background: "var(--menu-surface-2)" }}
              />
              <Price />
            </div>
          </div>
        ))}
      </div>
    );
  }
  if (layout === "vertical-grande") {
    return (
      <div
        className="overflow-hidden"
        style={{
          background: "var(--menu-surface)",
          border: "1px solid var(--menu-border)",
          borderRadius: "calc(var(--menu-radius) / 2)",
        }}
      >
        <div className="h-10" style={{ background: "var(--menu-surface-2)" }} />
        <div className="p-1.5 space-y-1">
          <div className="h-2 w-3/5 rounded" style={{ background: "var(--menu-surface-2)" }} />
          <div className="h-1.5 w-4/5 rounded" style={{ background: "var(--menu-surface-2)" }} />
          <Price />
        </div>
      </div>
    );
  }
  if (layout === "lista-densa") {
    return (
      <div className="divide-y" style={{ borderColor: "var(--menu-border)" }}>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="flex items-center justify-between py-1"
            style={{ borderColor: "var(--menu-border)" }}
          >
            <div className="h-1.5 w-1/2 rounded" style={{ background: "var(--menu-surface-2)" }} />
            <Price />
          </div>
        ))}
      </div>
    );
  }
  // horizontal
  return (
    <div className="space-y-1.5">
      {[0, 1].map((i) => (
        <div
          key={i}
          className="flex gap-1.5 p-1"
          style={{
            background: "var(--menu-surface)",
            border: "1px solid var(--menu-border)",
            borderRadius: "calc(var(--menu-radius) / 2)",
          }}
        >
          <div
            className="h-7 w-7 shrink-0"
            style={{
              background: "var(--menu-surface-2)",
              borderRadius: "calc(var(--menu-radius) / 3)",
            }}
          />
          <div className="flex-1 space-y-0.5 min-w-0">
            <div className="h-1.5 w-3/4 rounded" style={{ background: "var(--menu-surface-2)" }} />
            <Price />
          </div>
        </div>
      ))}
    </div>
  );
}
