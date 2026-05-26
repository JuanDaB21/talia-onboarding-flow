import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Bell, CreditCard, ImageIcon, Loader2, Plus, X } from "lucide-react";
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
    refetchInterval: 15000,
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
      <header
        className="sticky top-0 z-20 backdrop-blur"
        style={{
          background: "color-mix(in oklab, var(--menu-bg) 88%, transparent)",
          borderBottom: "1px solid var(--menu-border)",
        }}
      >
        <div className="flex items-center gap-3 px-4 pt-3 pb-2">
          <div className="min-w-0 flex-1">
            <p
              className="text-[11px] uppercase tracking-wider"
              style={{ color: "var(--menu-muted)" }}
            >
              Mesa {mesa.identificador}
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
        </div>
        {categorias.length > 0 && (
          <div className="flex gap-2 overflow-x-auto px-4 pb-3 scrollbar-none">
            <CategoryPill
              label="Todo"
              active={catActiva === null}
              onClick={() => setCatActiva(null)}
            />
            {categorias.map((c) => (
              <CategoryPill
                key={c.id_categoria}
                label={c.nombre}
                active={catActiva === c.id_categoria}
                onClick={() => setCatActiva(c.id_categoria)}
              />
            ))}
          </div>
        )}
      </header>

      <section className="px-4 pt-4 space-y-3">
        {productosFiltrados.length === 0 ? (
          <p
            className="text-center text-sm py-12"
            style={{ color: "var(--menu-muted)" }}
          >
            No hay productos disponibles en esta categoría.
          </p>
        ) : (
          productosFiltrados.map((p) => <ProductoCard key={p.id_producto} p={p} />)
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
    </main>
  );

  function CategoryPill({
    label,
    active,
    onClick,
  }: {
    label: string;
    active: boolean;
    onClick: () => void;
  }) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="shrink-0 px-4 py-1.5 text-sm font-medium transition-colors"
        style={{
          borderRadius: "9999px",
          background: active ? "var(--menu-primary)" : "var(--menu-surface)",
          color: active ? "var(--menu-primary-foreground)" : "var(--menu-foreground)",
          borderColor: active ? "var(--menu-primary)" : "var(--menu-border)",
          borderWidth: 1,
          borderStyle: "solid",
          fontFamily: "var(--menu-body-font)",
        }}
      >
        {label}
      </button>
    );
  }

  function ProductoCard({ p }: { p: CartaProducto }) {
    return (
      <article
        className="flex gap-3 p-3 shadow-sm"
        style={{
          background: "var(--menu-surface)",
          borderColor: "var(--menu-border)",
          borderWidth: 1,
          borderStyle: "solid",
          borderRadius: "var(--menu-radius)",
        }}
      >
        <div
          className="h-20 w-20 shrink-0 overflow-hidden flex items-center justify-center"
          style={{
            background: "var(--menu-surface-2)",
            borderRadius: "calc(var(--menu-radius) - 4px)",
          }}
        >
          {p.url_imagen ? (
            <img src={p.url_imagen} alt={p.nombre_producto} className="h-full w-full object-cover" />
          ) : (
            <ImageIcon className="h-6 w-6" style={{ color: "var(--menu-muted)" }} />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h3
            className="font-semibold leading-tight line-clamp-1"
            style={{ fontFamily: "var(--menu-heading-font)" }}
          >
            {p.nombre_producto}
          </h3>
          {p.descripcion_producto && (
            <p
              className="mt-0.5 text-xs line-clamp-2"
              style={{ color: "var(--menu-muted)" }}
            >
              {p.descripcion_producto}
            </p>
          )}
          <p
            className="mt-1.5 text-sm font-bold tabular-nums"
            style={{ color: "var(--menu-accent)" }}
          >
            {fmt.format(p.precio_venta)}
          </p>
        </div>
      </article>
    );
  }
}

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
