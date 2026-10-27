import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { getMenuPublicoNegocio, type CartaProducto } from "@/lib/menu-publico.functions";
import { getOpcionesProductoCarta } from "@/lib/domicilios-publico.functions";
import { formatMoney } from "@/lib/format";
import { publicUrl } from "@/lib/storage";
import { enlaceWhatsApp } from "@/lib/whatsapp";
import { getMenuTheme, getThemeStyle } from "@/lib/menu-themes";
import { useMenuFonts } from "@/hooks/use-menu-fonts";
import { ProductoCard } from "@/components/menu-publico/producto-card";
import { BuscadorCarta, MenuCuerpo } from "@/components/menu-publico/menu-cuerpo";
import { filtrarPorBusqueda } from "@/components/menu-publico/busqueda";
import { FondoMedia } from "@/components/menu-publico/fondo-media";
import { CartaHero } from "@/components/menu-publico/pedido/carta-hero";
import { WhatsAppIcon } from "@/components/menu-publico/pedido/iconos-marca";
import {
  leerPedidosRecientes,
  useCarrito,
  type NuevaLinea,
  type PedidoReciente,
} from "@/components/menu-publico/pedido/carrito";

// Detalle y checkout se cargan solo cuando el cliente los abre (contrato P6: bundle de carta).
const LazyProductoDetalleDialog = lazy(
  () => import("@/components/menu-publico/producto-detalle-dialog"),
);
const LazyProductoPedidoSheet = lazy(
  () => import("@/components/menu-publico/pedido/producto-pedido-sheet"),
);
const LazyCheckoutSheet = lazy(() => import("@/components/menu-publico/pedido/checkout-sheet"));

export const Route = createFileRoute("/carta-publica/$idNegocio")({
  head: () => ({
    meta: [
      { title: "Menú — Talia" },
      { name: "description", content: "Explora nuestro menú y pide a domicilio o para recoger." },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
    ],
  }),
  component: CartaPublicaPage,
});

// Carta pública del negocio (enlace para redes/WhatsApp). Si el negocio activa domicilios o
// "para recoger" en Configuración, el cliente arma su pedido aquí (sin cuenta) y lo sigue por
// /pedido/$token; si no, es la carta de solo lectura de siempre.
function CartaPublicaPage() {
  const { idNegocio } = Route.useParams();
  const qc = useQueryClient();
  const [busqueda, setBusqueda] = useState("");
  const [productoSel, setProductoSel] = useState<CartaProducto | null>(null);
  const [checkoutAbierto, setCheckoutAbierto] = useState(false);
  const [pedidoEnCurso, setPedidoEnCurso] = useState<PedidoReciente | null>(null);
  const [pulso, setPulso] = useState(0);
  const carrito = useCarrito(idNegocio);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["carta-publica-negocio", idNegocio],
    queryFn: () => getMenuPublicoNegocio(idNegocio),
    retry: false,
  });

  useEffect(() => {
    setPedidoEnCurso(leerPedidosRecientes(idNegocio)[0] ?? null);
  }, [idNegocio]);

  const productosFiltrados = useMemo(
    () => (data ? filtrarPorBusqueda(data.productos, busqueda) : []),
    [data, busqueda],
  );

  const themeId = data?.negocio?.tema_menu;
  const theme = useMemo(() => getMenuTheme(themeId), [themeId]);
  const themeStyle = useMemo(() => getThemeStyle(themeId), [themeId]);

  useMenuFonts(themeId);

  const negocio = data?.negocio;
  const domicilioOn = negocio?.domicilios_activo === true && (data?.municipios.length ?? 0) > 0;
  const recogerOn = negocio?.recoger_activo === true;
  const pide = domicilioOn || recogerOn;
  const negocioPedido = useMemo(
    () =>
      negocio ? { ...negocio, domicilios_activo: domicilioOn, recoger_activo: recogerOn } : null,
    [negocio, domicilioOn, recogerOn],
  );

  const agregar = useCallback(
    (l: NuevaLinea) => {
      carrito.agregar(l);
      setPulso((n) => n + 1);
      setProductoSel(null);
      toast.success(`${l.nombre} agregado`, { duration: 1500 });
    },
    [carrito],
  );

  // "+" rápido: si el producto no tiene variantes obligatorias se agrega directo; si las tiene,
  // se abre el detalle para elegir.
  const agregarRapido = useCallback(
    async (p: CartaProducto) => {
      try {
        const op = await qc.fetchQuery({
          queryKey: ["carta-publica", "opciones", idNegocio, p.id_producto],
          queryFn: () => getOpcionesProductoCarta(idNegocio, p.id_producto),
          staleTime: 60_000,
        });
        if (op.variantes.some((g) => g.seleccion === "UNICA" && g.opciones.length > 0)) {
          setProductoSel(p);
          return;
        }
        agregar({
          id_producto: p.id_producto,
          nombre: p.nombre_producto,
          url_imagen: p.url_imagen,
          precio_unitario: Number(p.precio_venta),
          nota: "",
          extras: [],
          exclusiones: [],
          variantes: [],
        });
      } catch {
        setProductoSel(p);
      }
    },
    [agregar, idNegocio, qc],
  );

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </main>
    );
  }

  if (isError || !data || !negocio || !negocioPedido) {
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

  const { categorias } = data;
  const logoUrl = publicUrl(negocio.url_logo ?? null);
  const envioDesde = data.municipios.length
    ? Math.min(...data.municipios.map((m) => m.costo_envio))
    : null;
  const wa = enlaceWhatsApp(
    negocio.whatsapp_numero,
    pedidoEnCurso
      ? `Hola, quiero saber el estado de mi pedido ${pedidoEnCurso.codigo}.`
      : `Hola ${negocio.nombre_comercial}, tengo una pregunta.`,
  );
  const hayCarrito = pide && carrito.unidades > 0;
  const conFondo = (negocio.fondo?.tipo ?? "NINGUNO") !== "NINGUNO" && !!negocio.fondo?.url;

  return (
    <main
      style={{
        ...themeStyle,
        background: "var(--menu-bg)",
        color: "var(--menu-foreground)",
        fontFamily: "var(--menu-body-font)",
      }}
      className={`menu-raiz relative isolate min-h-dvh ${hayCarrito ? "pb-32" : "pb-16"}`}
    >
      <FondoMedia fondo={negocio.fondo} theme={theme} />
      <CartaHero
        negocio={negocioPedido}
        logoUrl={logoUrl}
        envioDesde={envioDesde}
        tipo={carrito.tipo}
        onTipo={carrito.setTipo}
        pedidoEnCurso={pedidoEnCurso}
        conFondo={conFondo}
      />

      <MenuCuerpo
        theme={theme}
        categorias={categorias}
        productos={productosFiltrados}
        filtrando={busqueda.trim().length > 0}
        vacio={
          busqueda
            ? "No encontramos productos con ese nombre."
            : "No hay productos disponibles por ahora."
        }
        barraSuperior={<BuscadorCarta value={busqueda} onChange={setBusqueda} />}
        renderProducto={(p) => (
          <div className="relative h-full [&>button:first-child]:h-full">
            <ProductoCard p={p} theme={theme} onClick={() => setProductoSel(p)} />
            {pide && (
              <BotonAgregar
                cantidad={carrito.porProducto.get(p.id_producto) ?? 0}
                onClick={() => void agregarRapido(p)}
                nombre={p.nombre_producto}
              />
            )}
          </div>
        )}
      />

      {/* Contacto flotante: WhatsApp de caja (pedidos / estado del domicilio). Con carrito
          se integra a la barra inferior para no tapar los botones "+" de las tarjetas. */}
      {wa && !hayCarrito && (
        <a
          href={wa}
          target="_blank"
          rel="noreferrer"
          aria-label="Escríbenos por WhatsApp"
          className="fixed bottom-5 right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full transition-transform active:scale-95"
          style={{
            background: "var(--menu-primary)",
            color: "var(--menu-primary-foreground)",
            boxShadow: "0 10px 30px -10px color-mix(in oklab, var(--menu-primary) 70%, black)",
          }}
        >
          <WhatsAppIcon className="h-7 w-7" />
        </a>
      )}

      {hayCarrito && (
        <div className="fixed inset-x-0 bottom-0 z-30 mx-auto flex max-w-lg gap-2 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {wa && (
            <a
              href={wa}
              target="_blank"
              rel="noreferrer"
              aria-label="Escríbenos por WhatsApp"
              className="flex h-14 w-14 shrink-0 items-center justify-center transition-transform active:scale-95"
              style={{
                background: "var(--menu-primary)",
                color: "var(--menu-primary-foreground)",
                borderRadius: "calc(var(--menu-radius) + 0.25rem)",
              }}
            >
              <WhatsAppIcon className="h-6 w-6" />
            </a>
          )}
          <button
            key={pulso}
            type="button"
            onClick={() => setCheckoutAbierto(true)}
            className="flex h-14 min-w-0 flex-1 items-center gap-3 px-4 text-left animate-in zoom-in-95 duration-200"
            style={{
              background: "var(--menu-foreground)",
              color: "var(--menu-bg)",
              borderRadius: "calc(var(--menu-radius) + 0.25rem)",
              boxShadow:
                "0 18px 40px -16px color-mix(in oklab, var(--menu-foreground) 80%, transparent)",
            }}
          >
            <span
              className="flex h-8 min-w-8 items-center justify-center rounded-full px-2 text-sm font-bold"
              style={{ background: "var(--menu-primary)", color: "var(--menu-primary-foreground)" }}
            >
              {carrito.unidades}
            </span>
            <span className="flex min-w-0 flex-1 items-center gap-2 whitespace-nowrap text-sm font-semibold">
              <ShoppingBag className="h-4 w-4 shrink-0" />
              <span className="truncate">Ver pedido</span>
            </span>
            <span className="shrink-0 whitespace-nowrap text-sm font-bold">
              {formatMoney(carrito.subtotal)}
            </span>
          </button>
        </div>
      )}

      <Suspense fallback={null}>
        {pide ? (
          <LazyProductoPedidoSheet
            idNegocio={idNegocio}
            producto={productoSel}
            themeStyle={themeStyle}
            onClose={() => setProductoSel(null)}
            onAgregar={agregar}
          />
        ) : (
          <LazyProductoDetalleDialog
            producto={productoSel}
            theme={theme}
            themeStyle={themeStyle}
            onClose={() => setProductoSel(null)}
          />
        )}
        {pide && checkoutAbierto && (
          <LazyCheckoutSheet
            open={checkoutAbierto}
            onOpenChange={setCheckoutAbierto}
            idNegocio={idNegocio}
            negocio={negocioPedido}
            municipios={data.municipios}
            metodos={data.metodos_pago}
            carrito={carrito}
            themeStyle={themeStyle}
          />
        )}
      </Suspense>
    </main>
  );
}

function BotonAgregar({
  cantidad,
  onClick,
  nombre,
}: {
  cantidad: number;
  onClick: () => void;
  nombre: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Agregar ${nombre}`}
      className="absolute bottom-2.5 right-2.5 z-[1] flex h-9 items-center justify-center gap-1 rounded-full px-2.5 text-sm font-bold transition-transform active:scale-90"
      style={{
        minWidth: "2.25rem",
        background: "var(--menu-primary)",
        color: "var(--menu-primary-foreground)",
        boxShadow: "0 6px 16px -6px color-mix(in oklab, var(--menu-primary) 80%, black)",
      }}
    >
      {cantidad > 0 ? <span className="tabular-nums">{cantidad}</span> : null}
      <Plus className="h-4 w-4" strokeWidth={2.75} />
    </button>
  );
}
