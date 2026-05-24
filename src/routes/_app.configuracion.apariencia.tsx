import { useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ImageIcon, Loader2, Trash2, Upload, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
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
  const getCfg = useServerFn(getNegocioConfig);
  const updateCfg = useServerFn(updateNegocioApariencia);

  const { data, isLoading } = useQuery({
    queryKey: ["negocio-config"],
    queryFn: () => getCfg(),
  });

  const mut = useMutation({
    mutationFn: (patch: { tema_menu?: MenuThemeId; url_logo?: string | null }) =>
      updateCfg({ data: patch }),
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
    const { data: mesa } = await supabase
      .from("mesas")
      .select("id_mesa")
      .eq("id_negocio", data.id_negocio)
      .limit(1)
      .maybeSingle();
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
          mut.mutate(
            { url_logo: url },
            { onSuccess: () => toast.success("Logo actualizado") },
          )
        }
        onRemove={() =>
          mut.mutate(
            { url_logo: null },
            { onSuccess: () => toast.success("Logo eliminado") },
          )
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
      const ext = file.name.split(".").pop() ?? "png";
      const path = `${idNegocio}/logo-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("negocio-logos")
        .upload(path, file, { upsert: false, cacheControl: "3600" });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("negocio-logos").getPublicUrl(path);
      onUpload(pub.publicUrl);
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
            <img src={urlLogo} alt="Logo" className="h-full w-full object-contain" />
          ) : (
            <ImageIcon className="h-8 w-8 text-muted-foreground" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold">Logo del negocio</h2>
          <p className="text-sm text-muted-foreground">
            Aparece arriba a la derecha del menú público. Recomendado cuadrado, PNG o SVG con fondo transparente. Máx 2MB.
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
        selected
          ? "border-primary ring-2 ring-primary/30"
          : "border-border hover:border-primary/40"
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
      <div style={style} className="aspect-[4/3] p-4">
        <div
          className="h-full w-full rounded-[var(--menu-radius)] p-3 flex flex-col gap-2"
          style={{
            background: "var(--menu-bg)",
            color: "var(--menu-foreground)",
            fontFamily: "var(--menu-body-font)",
          }}
        >
          <div className="flex items-center justify-between">
            <div
              style={{ fontFamily: "var(--menu-heading-font)" }}
              className="text-sm font-bold leading-none"
            >
              Nuestra carta
            </div>
            <div
              className="h-6 w-6 rounded-full"
              style={{ background: "var(--menu-primary)" }}
            />
          </div>
          <div className="flex gap-1.5">
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-medium"
              style={{
                background: "var(--menu-primary)",
                color: "var(--menu-primary-foreground)",
              }}
            >
              Todo
            </span>
            <span
              className="rounded-full px-2 py-0.5 text-[10px]"
              style={{
                background: "var(--menu-surface-2)",
                color: "var(--menu-foreground)",
              }}
            >
              Entradas
            </span>
          </div>
          <div
            className="flex-1 rounded-[calc(var(--menu-radius)-2px)] p-2"
            style={{
              background: "var(--menu-surface)",
              borderColor: "var(--menu-border)",
              borderWidth: 1,
              borderStyle: "solid",
            }}
          >
            <div className="h-2.5 w-3/5 rounded" style={{ background: "var(--menu-surface-2)" }} />
            <div className="mt-1.5 h-2 w-4/5 rounded" style={{ background: "var(--menu-surface-2)" }} />
            <div
              className="mt-2 inline-block rounded px-1.5 py-0.5 text-[10px] font-bold"
              style={{ color: "var(--menu-accent)" }}
            >
              $ 25.000
            </div>
          </div>
          <div
            className="rounded-[calc(var(--menu-radius)-2px)] py-1.5 text-center text-[10px] font-semibold"
            style={{
              background: "var(--menu-primary)",
              color: "var(--menu-primary-foreground)",
            }}
          >
            Llamar mesero
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
