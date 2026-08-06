import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { getMenuPublicoNegocio, type CartaProducto } from "@/lib/menu-publico.functions";
import { publicUrl } from "@/lib/storage";
import { getMenuTheme, getThemeFontsUrl, getThemeStyle } from "@/lib/menu-themes";
import { ProductoCard } from "@/components/menu-publico/producto-card";
import { ThemedHeader, CategoryNav } from "@/components/menu-publico/menu-chrome";

// El detalle de producto solo se carga cuando el cliente toca un producto.
const LazyProductoDetalleDialog = lazy(
  () => import("@/components/menu-publico/producto-detalle-dialog"),
);

export const Route = createFileRoute("/carta-publica/$idNegocio")({
  head: () => ({
    meta: [
      { title: "Menú — Talia" },
      { name: "description", content: "Explora nuestro menú." },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
    ],
  }),
  component: CartaPublicaPage,
});

// Menú público del negocio (para compartir en redes/WhatsApp). Solo lectura:
// sin onboarding/nombre, sin prepedido, sin llamar mesero ni pedir la cuenta.
// El cliente solo mira la carta.
function CartaPublicaPage() {
  const { idNegocio } = Route.useParams();
  const [catActiva, setCatActiva] = useState<string | null>(null);
  const [productoSel, setProductoSel] = useState<CartaProducto | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["carta-publica-negocio", idNegocio],
    queryFn: () => getMenuPublicoNegocio(idNegocio),
    retry: false,
  });

  const productosFiltrados = useMemo(() => {
    if (!data) return [];
    if (!catActiva) return data.productos;
    return data.productos.filter((p) => p.id_categoria === catActiva);
  }, [data, catActiva]);

  const themeId = data?.negocio?.tema_menu;
  const theme = useMemo(() => getMenuTheme(themeId), [themeId]);
  const themeStyle = useMemo(() => getThemeStyle(themeId), [themeId]);

  // Cargar Google Fonts del tema activo
  useEffect(() => {
    if (!themeId) return;
    const href = getThemeFontsUrl(themeId);
    const id = `menu-fonts-${themeId}`;
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = href;
    document.head.appendChild(link);
  }, [themeId]);

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </main>
    );
  }

  if (isError || !data) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-6">
        <div className="max-w-sm text-center space-y-2">
          <h1 className="text-xl font-semibold">Menú no disponible</h1>
          <p className="text-sm text-muted-foreground">
            No pudimos cargar el menú. Intenta de nuevo más tarde.
          </p>
        </div>
      </main>
    );
  }

  const { categorias, negocio } = data;
  const logoUrl = publicUrl(negocio?.url_logo ?? null);
  const nombreNegocio = negocio?.nombre_comercial ?? "";

  return (
    <main
      style={{
        ...themeStyle,
        background: "var(--menu-bg)",
        color: "var(--menu-foreground)",
        fontFamily: "var(--menu-body-font)",
      }}
      className="min-h-screen pb-10"
    >
      <ThemedHeader theme={theme} nombreNegocio={nombreNegocio} logoUrl={logoUrl} />

      {categorias.length > 0 && (
        <div
          className="sticky z-10 backdrop-blur"
          style={{
            top: 0,
            background: "color-mix(in oklab, var(--menu-bg) 92%, transparent)",
            borderBottom: "1px solid var(--menu-border)",
          }}
        >
          <CategoryNav
            theme={theme}
            categorias={categorias}
            activa={catActiva}
            onSelect={setCatActiva}
          />
        </div>
      )}

      <section
        className={
          theme.productLayout === "hero-grid"
            ? "px-4 pt-5 grid grid-cols-2 gap-3"
            : theme.productLayout === "lista-densa"
              ? "px-4 pt-5 divide-y"
              : "px-4 pt-5 space-y-3"
        }
        style={
          theme.productLayout === "lista-densa"
            ? ({ borderColor: "var(--menu-border)" } as React.CSSProperties)
            : undefined
        }
      >
        {productosFiltrados.length === 0 ? (
          <p
            className="col-span-2 text-center text-sm py-12"
            style={{ color: "var(--menu-muted)" }}
          >
            No hay productos disponibles en esta categoría.
          </p>
        ) : (
          productosFiltrados.map((p) => (
            <ProductoCard
              key={p.id_producto}
              p={p}
              theme={theme}
              onClick={() => setProductoSel(p)}
            />
          ))
        )}
      </section>

      <Suspense fallback={null}>
        <LazyProductoDetalleDialog
          producto={productoSel}
          theme={theme}
          themeStyle={themeStyle}
          onClose={() => setProductoSel(null)}
        />
      </Suspense>
    </main>
  );
}
