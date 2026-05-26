import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Bell, CreditCard, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  getMenuPublico,
  llamarMesero,
  getEstadoMesaPublico,
  solicitarAccionCliente,
  getCuentaPublica,
  type CartaProducto,
  type CuentaPublica,
} from "@/lib/menu-publico.functions";
import { getMenuTheme, getThemeFontsUrl, getThemeStyle, type MenuTheme } from "@/lib/menu-themes";
import { POLL } from "@/lib/query-config";
import { ProductoCard } from "@/components/menu-publico/producto-card";

// El detalle de producto solo se carga cuando el cliente toca un producto.
const ProductoDetalleDialog = lazy(
  () => import("@/components/menu-publico/producto-detalle-dialog"),
);


export const Route = createFileRoute("/carta/$idMesa")({
  head: () => ({
    meta: [
      { title: "Menú — Talia" },
      { name: "description", content: "Revisa la carta y llama a tu mesero." },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
    ],
  }),
  component: CartaPage,
});

const fmt = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

function CartaPage() {
  const { idMesa } = Route.useParams();
  const [fase, setFase] = useState<"onboarding" | "menu">("onboarding");
  const [catActiva, setCatActiva] = useState<string | null>(null);

  const getMenu = useServerFn(getMenuPublico);
  const callMesero = useServerFn(llamarMesero);
  const getEstado = useServerFn(getEstadoMesaPublico);
  const solicitar = useServerFn(solicitarAccionCliente);
  const getCuenta = useServerFn(getCuentaPublica);

  const [cuentaOpen, setCuentaOpen] = useState(false);
  const [cuenta, setCuenta] = useState<CuentaPublica | null>(null);
  const [cargandoCuenta, setCargandoCuenta] = useState(false);
  const [productoSel, setProductoSel] = useState<CartaProducto | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["carta", idMesa],
    queryFn: () => getMenu({ data: { idMesa } }),
    retry: false,
  });

  const estadoQ = useQuery({
    queryKey: ["estadoMesaPublico", idMesa],
    queryFn: () => getEstado({ data: { idMesa } }),
    ...POLL.LIVE,
    retry: false,
  });

  const mut = useMutation({
    mutationFn: () => callMesero({ data: { idMesa } }),
    onSuccess: () => {
      toast.success("¡Tu mesero va en camino!");
      refetch();
    },
    onError: (e) => {
      toast.error("No se pudo llamar al mesero", {
        description: e instanceof Error ? e.message : undefined,
      });
    },
  });

  const solicitarMut = useMutation({
    mutationFn: (tipo: "PEDIR_MAS" | "CUENTA") =>
      solicitar({ data: { idMesa, tipo } }),
    onSuccess: (_, tipo) => {
      toast.success(
        tipo === "CUENTA"
          ? "Pedimos la cuenta a tu mesero 🧾"
          : "Le avisamos a tu mesero que quieres pedir más ➕",
      );
    },
    onError: (e) => {
      toast.error("No se pudo enviar la solicitud", {
        description: e instanceof Error ? e.message : undefined,
      });
    },
  });

  const handlePedirCuenta = async () => {
    setCuentaOpen(true);
    setCargandoCuenta(true);
    try {
      const [c] = await Promise.all([
        getCuenta({ data: { idMesa } }),
        solicitar({ data: { idMesa, tipo: "CUENTA" } }).catch(() => null),
      ]);
      setCuenta(c);
      toast.success("Pedimos la cuenta a tu mesero 🧾");
    } catch (e) {
      toast.error("No se pudo cargar la cuenta", {
        description: e instanceof Error ? e.message : undefined,
      });
      setCuentaOpen(false);
    } finally {
      setCargandoCuenta(false);
    }
  };


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
          <h1 className="text-xl font-semibold">Mesa no válida</h1>
          <p className="text-sm text-muted-foreground">
            No pudimos cargar el menú. Pide ayuda al personal del restaurante.
          </p>
        </div>
      </main>
    );
  }

  const { mesa, categorias, negocio } = data;
  const ocupada = mesa.estado === "OCUPADA";
  const logoUrl = negocio?.url_logo ?? null;
  const nombreNegocio = negocio?.nombre_comercial ?? "";

  if (fase === "onboarding") {
    return (
      <main
        style={{ ...themeStyle, background: "var(--menu-bg)", color: "var(--menu-foreground)", fontFamily: "var(--menu-body-font)" }}
        className="flex min-h-screen items-center justify-center px-6"
      >
        <div
          className="w-full max-w-sm p-6 text-center space-y-5 shadow-sm"
          style={{
            background: "var(--menu-surface)",
            borderColor: "var(--menu-border)",
            borderWidth: 1,
            borderStyle: "solid",
            borderRadius: "calc(var(--menu-radius) * 1.5)",
          }}
        >
          {logoUrl && (
            <div className="flex justify-center">
              <img
                src={logoUrl}
                alt={nombreNegocio}
                className="h-20 w-20 rounded-full object-contain bg-white/50 p-1"
                style={{ borderColor: "var(--menu-border)", borderWidth: 1 }}
              />
            </div>
          )}
          <div
            className="inline-flex items-center justify-center rounded-full px-4 py-1 text-xs font-medium"
            style={{
              background: "var(--menu-surface-2)",
              color: "var(--menu-primary)",
            }}
          >
            Mesa {mesa.identificador}
          </div>
          <h1
            className="text-2xl font-bold leading-tight"
            style={{ fontFamily: "var(--menu-heading-font)" }}
          >
            ¡Bienvenido{nombreNegocio ? ` a ${nombreNegocio}` : ""}!
          </h1>
          <p className="text-sm leading-relaxed" style={{ color: "var(--menu-muted)" }}>
            Revisa nuestro menú y cuando tengas claro qué vas a pedir llama a tu
            mesero, te atenderemos con gusto.
          </p>
          <Button
            className="w-full h-12 text-base"
            style={{
              background: "var(--menu-primary)",
              color: "var(--menu-primary-foreground)",
              borderRadius: "var(--menu-radius)",
            }}
            onClick={() => setFase("menu")}
          >
            Continuar
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main
      style={{ ...themeStyle, background: "var(--menu-bg)", color: "var(--menu-foreground)", fontFamily: "var(--menu-body-font)" }}
      className="min-h-screen pb-28"
    >
      <ThemedHeader
        theme={theme}
        mesa={mesa.identificador}
        nombreNegocio={nombreNegocio}
        logoUrl={logoUrl}
      />
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


      <div
        className="fixed inset-x-0 bottom-0 z-30 backdrop-blur"
        style={{
          background: "color-mix(in oklab, var(--menu-bg) 92%, transparent)",
          borderTop: "1px solid var(--menu-border)",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        <div className="mx-auto max-w-2xl p-3">
          {estadoQ.data?.tiene_pedido_activo ? (
            <div className="grid grid-cols-2 gap-2">
              <Button
                size="lg"
                className="h-14 text-base font-semibold gap-2"
                style={{
                  background: "var(--menu-surface)",
                  color: "var(--menu-foreground)",
                  borderColor: "var(--menu-border)",
                  borderWidth: 1,
                  borderRadius: "var(--menu-radius)",
                }}
                onClick={() => solicitarMut.mutate("PEDIR_MAS")}
                disabled={solicitarMut.isPending}
              >
                <Plus className="h-5 w-5" />
                Pedir más
              </Button>
              <Button
                size="lg"
                className="h-14 text-base font-semibold gap-2"
                style={{
                  background: "var(--menu-primary)",
                  color: "var(--menu-primary-foreground)",
                  borderRadius: "var(--menu-radius)",
                }}
                onClick={handlePedirCuenta}
                disabled={cargandoCuenta}
              >
                <CreditCard className="h-5 w-5" />
                Pedir la cuenta
              </Button>
            </div>
          ) : (
            <Button
              size="lg"
              className="w-full h-14 text-base font-semibold gap-2"
              style={{
                background: ocupada ? "var(--menu-surface-2)" : "var(--menu-primary)",
                color: ocupada ? "var(--menu-foreground)" : "var(--menu-primary-foreground)",
                borderRadius: "var(--menu-radius)",
                opacity: ocupada ? 0.85 : 1,
              }}
              onClick={() => mut.mutate()}
              disabled={mut.isPending || ocupada}
            >
              {mut.isPending ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Bell className="h-5 w-5" />
              )}
              {ocupada ? "Mesero notificado" : "Llamar mesero"}
            </Button>
          )}
        </div>
      </div>

      <CuentaDialog
        open={cuentaOpen}
        onOpenChange={setCuentaOpen}
        cuenta={cuenta}
        cargando={cargandoCuenta}
        mesa={mesa.identificador}
        nombreNegocio={nombreNegocio}
        logoUrl={logoUrl}
      />

      <Suspense fallback={null}>
        <ProductoDetalleDialog
          producto={productoSel}
          theme={theme}
          themeStyle={themeStyle}
          onClose={() => setProductoSel(null)}
        />
      </Suspense>
    </main>
  );
}

// ============================================================
// Header con variantes según el tema
// ============================================================
function ThemedHeader({
  theme,
  mesa,
  nombreNegocio,
  logoUrl,
}: {
  theme: MenuTheme;
  mesa: string;
  nombreNegocio: string;
  logoUrl: string | null;
}) {
  const style = theme.headerStyle;

  if (style === "hero-centrado") {
    return (
      <header
        className="px-4 pt-8 pb-6 text-center"
        style={{
          background: theme.vars["--menu-gradient"]
            ? "var(--menu-gradient)"
            : "var(--menu-surface)",
          borderBottom: "1px solid var(--menu-border)",
        }}
      >
        {logoUrl && (
          <img
            src={logoUrl}
            alt={nombreNegocio}
            className="mx-auto h-20 w-20 rounded-full object-contain bg-white/70 p-1 mb-3"
            style={{ borderColor: "var(--menu-border)", borderWidth: 1 }}
          />
        )}
        <p
          className="text-[10px] uppercase tracking-[0.3em]"
          style={{ color: "var(--menu-accent)" }}
        >
          Mesa {mesa}
        </p>
        <h1
          className="mt-1 text-3xl font-bold leading-tight"
          style={{ fontFamily: "var(--menu-heading-font)" }}
        >
          {nombreNegocio || "Nuestra carta"}
        </h1>
        <div
          className="mx-auto mt-3 h-px w-16"
          style={{ background: "var(--menu-accent)" }}
        />
      </header>
    );
  }

  if (style === "banner-gradiente") {
    return (
      <header
        className="px-5 pt-6 pb-7 flex items-center gap-4"
        style={{
          background: theme.vars["--menu-gradient"] ?? "var(--menu-primary)",
          color: "var(--menu-primary-foreground)",
        }}
      >
        {logoUrl && (
          <img
            src={logoUrl}
            alt={nombreNegocio}
            className="h-16 w-16 shrink-0 rounded-full object-contain bg-white/90 p-1"
          />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-[11px] uppercase tracking-widest opacity-80">
            Mesa {mesa}
          </p>
          <h1
            className="text-2xl font-bold leading-tight truncate"
            style={{ fontFamily: "var(--menu-heading-font)" }}
          >
            {nombreNegocio || "Nuestra carta"}
          </h1>
        </div>
      </header>
    );
  }

  if (style === "editorial") {
    return (
      <header
        className="px-5 pt-6 pb-5"
        style={{
          background: "var(--menu-surface)",
          borderBottom: "1px solid var(--menu-border)",
        }}
      >
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p
              className="text-[10px] uppercase tracking-[0.3em]"
              style={{ color: "var(--menu-accent)" }}
            >
              · Mesa {mesa} ·
            </p>
            <h1
              className="mt-1 text-3xl font-bold leading-[1.05] italic"
              style={{ fontFamily: "var(--menu-heading-font)" }}
            >
              {nombreNegocio || "Nuestra carta"}
            </h1>
          </div>
          {logoUrl && (
            <img
              src={logoUrl}
              alt={nombreNegocio}
              className="h-14 w-14 shrink-0 rounded-full object-contain bg-white/40 p-0.5"
              style={{ borderColor: "var(--menu-border)", borderWidth: 1 }}
            />
          )}
        </div>
        <div
          className="mt-3 flex items-center gap-2"
          aria-hidden
        >
          <div className="h-px flex-1" style={{ background: "var(--menu-border)" }} />
          <div
            className="text-xs tracking-widest"
            style={{ color: "var(--menu-muted)" }}
          >
            CARTA
          </div>
          <div className="h-px flex-1" style={{ background: "var(--menu-border)" }} />
        </div>
      </header>
    );
  }

  // minimal
  return (
    <header
      className="flex items-center gap-3 px-4 pt-4 pb-3"
      style={{
        background: "var(--menu-surface)",
        borderBottom: "1px solid var(--menu-border)",
      }}
    >
      <div className="min-w-0 flex-1">
        <p
          className="text-[11px] uppercase tracking-wider"
          style={{ color: "var(--menu-muted)" }}
        >
          Mesa {mesa}
        </p>
        <h1
          className="text-lg font-bold leading-tight truncate"
          style={{ fontFamily: "var(--menu-heading-font)" }}
        >
          {nombreNegocio || "Nuestra carta"}
        </h1>
      </div>
      {logoUrl && (
        <img
          src={logoUrl}
          alt={nombreNegocio}
          className="h-12 w-12 shrink-0 rounded-full object-contain bg-white/40 p-0.5"
          style={{ borderColor: "var(--menu-border)", borderWidth: 1 }}
        />
      )}
    </header>
  );
}

// ============================================================
// Navegación de categorías con variantes
// ============================================================
function CategoryNav({
  theme,
  categorias,
  activa,
  onSelect,
}: {
  theme: MenuTheme;
  categorias: { id_categoria: string; nombre: string }[];
  activa: string | null;
  onSelect: (id: string | null) => void;
}) {
  const style = theme.categoryStyle;
  const items: { id: string | null; nombre: string }[] = [
    { id: null, nombre: "Todo" },
    ...categorias.map((c) => ({ id: c.id_categoria, nombre: c.nombre })),
  ];

  if (style === "tabs-subrayadas") {
    return (
      <div className="flex gap-5 overflow-x-auto px-5 py-3 scrollbar-none">
        {items.map((it) => {
          const active = activa === it.id;
          return (
            <button
              key={it.id ?? "all"}
              type="button"
              onClick={() => onSelect(it.id)}
              className="shrink-0 pb-1.5 text-sm font-medium whitespace-nowrap transition-colors"
              style={{
                color: active ? "var(--menu-foreground)" : "var(--menu-muted)",
                borderBottom: active
                  ? "2px solid var(--menu-accent)"
                  : "2px solid transparent",
                fontFamily: "var(--menu-body-font)",
              }}
            >
              {it.nombre}
            </button>
          );
        })}
      </div>
    );
  }

  if (style === "chips-grandes") {
    return (
      <div className="flex gap-2.5 overflow-x-auto px-4 py-3 scrollbar-none">
        {items.map((it) => {
          const active = activa === it.id;
          return (
            <button
              key={it.id ?? "all"}
              type="button"
              onClick={() => onSelect(it.id)}
              className="shrink-0 px-5 py-2.5 text-sm font-semibold transition-all"
              style={{
                borderRadius: "9999px",
                background: active
                  ? theme.vars["--menu-gradient"] ?? "var(--menu-primary)"
                  : "var(--menu-surface)",
                color: active
                  ? "var(--menu-primary-foreground)"
                  : "var(--menu-foreground)",
                boxShadow: active
                  ? "var(--menu-shadow, 0 6px 18px -8px rgba(0,0,0,0.2))"
                  : "none",
                fontFamily: "var(--menu-body-font)",
              }}
            >
              {it.nombre}
            </button>
          );
        })}
      </div>
    );
  }

  if (style === "tags-duros") {
    return (
      <div className="flex gap-2 overflow-x-auto px-4 py-3 scrollbar-none">
        {items.map((it) => {
          const active = activa === it.id;
          return (
            <button
              key={it.id ?? "all"}
              type="button"
              onClick={() => onSelect(it.id)}
              className="shrink-0 px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition-all"
              style={{
                background: active ? "var(--menu-foreground)" : "var(--menu-surface)",
                color: active ? "var(--menu-bg)" : "var(--menu-foreground)",
                border: "2px solid var(--menu-foreground)",
                borderRadius: "0px",
                fontFamily: "var(--menu-body-font)",
              }}
            >
              {it.nombre}
            </button>
          );
        })}
      </div>
    );
  }

  // pills (default)
  return (
    <div className="flex gap-2 overflow-x-auto px-4 py-3 scrollbar-none">
      {items.map((it) => {
        const active = activa === it.id;
        return (
          <button
            key={it.id ?? "all"}
            type="button"
            onClick={() => onSelect(it.id)}
            className="shrink-0 px-4 py-1.5 text-sm font-medium transition-colors"
            style={{
              borderRadius: "9999px",
              background: active ? "var(--menu-primary)" : "var(--menu-surface)",
              color: active
                ? "var(--menu-primary-foreground)"
                : "var(--menu-foreground)",
              borderColor: active ? "var(--menu-primary)" : "var(--menu-border)",
              borderWidth: 1,
              borderStyle: "solid",
              fontFamily: "var(--menu-body-font)",
            }}
          >
            {it.nombre}
          </button>
        );
      })}
    </div>
  );
}

// PriceTag, ProductoCard y ProductoDetalleDialog viven ahora en
// src/components/menu-publico/ (con memo, lazy y atributos lazy en <img>).



interface CuentaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cuenta: CuentaPublica | null;
  cargando: boolean;
  mesa: string;
  nombreNegocio: string;
  logoUrl: string | null;
}

function CuentaDialog({
  open,
  onOpenChange,
  cuenta,
  cargando,
  mesa,
  nombreNegocio,
  logoUrl,
}: CuentaDialogProps) {
  const fecha = cuenta ? new Date(cuenta.fecha) : new Date();
  const fechaFmt = fecha.toLocaleString("es-CO", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 text-center items-center border-b border-dashed">
          {logoUrl && (
            <img
              src={logoUrl}
              alt={nombreNegocio}
              className="h-14 w-14 rounded-full object-contain bg-muted p-1 mb-2"
            />
          )}
          <DialogTitle className="text-lg font-bold tracking-tight">
            {nombreNegocio || "Cuenta"}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Mesa {mesa} · {fechaFmt}
          </DialogDescription>
        </DialogHeader>

        {cargando && !cuenta ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : !cuenta || cuenta.items.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-muted-foreground">
            Aún no hay productos en tu cuenta.
          </div>
        ) : (
          <>
            <div className="max-h-[55vh] overflow-y-auto px-6 py-4">
              <div className="grid grid-cols-[auto_1fr_auto] gap-x-3 gap-y-3 text-sm">
                <div className="contents text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                  <span>Cant.</span>
                  <span>Descripción</span>
                  <span className="text-right">Total</span>
                </div>
                <div className="col-span-3 border-b border-dashed" />
                {cuenta.items.map((it) => (
                  <div key={it.id_item} className="contents">
                    <span className="tabular-nums font-medium pt-0.5">
                      {it.cantidad > 1 ? `${it.cantidad}×` : "•"}
                    </span>

                    <div className="min-w-0">
                      <p className="font-medium leading-tight break-words">
                        {it.nombre_producto}
                      </p>
                      <p className="text-xs text-muted-foreground tabular-nums">
                        {fmt.format(it.precio_unitario)} c/u
                      </p>
                      {it.extras.length > 0 && (
                        <ul className="mt-0.5 text-xs text-muted-foreground">
                          {it.extras.map((e, i) => (
                            <li key={i} className="flex justify-between gap-2">
                              <span>+ {e.nombre}</span>
                              {e.precio > 0 && (
                                <span className="tabular-nums">
                                  {fmt.format(e.precio)}
                                </span>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                      {it.exclusiones.length > 0 && (
                        <p className="text-xs text-muted-foreground italic">
                          sin {it.exclusiones.map((x) => x.nombre).join(", ")}
                        </p>
                      )}
                      {it.nota && (
                        <p className="text-xs text-muted-foreground italic">
                          Nota: {it.nota}
                        </p>
                      )}
                    </div>
                    <span className="tabular-nums font-semibold pt-0.5 text-right">
                      {fmt.format(it.subtotal)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="px-6 py-4 border-t border-dashed bg-muted/30">
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-semibold uppercase tracking-wider">
                  Total
                </span>
                <span className="text-2xl font-extrabold tabular-nums">
                  {fmt.format(cuenta.total)}
                </span>
              </div>
              <p className="mt-2 text-[11px] text-center text-muted-foreground leading-relaxed">
                Tu mesero ya fue notificado y se acercará a cobrar.
                <br />
                Gracias por tu visita 🙌
              </p>
            </div>
          </>
        )}

        <DialogFooter className="px-6 pb-6 pt-2">
          <Button
            variant="outline"
            className="w-full"
            onClick={() => onOpenChange(false)}
          >
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
