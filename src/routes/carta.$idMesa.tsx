import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Bell, CreditCard, ImageIcon, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  getMenuPublico,
  llamarMesero,
  getEstadoMesaPublico,
  solicitarAccionCliente,
  type CartaProducto,
} from "@/lib/menu-publico.functions";


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


  const productosFiltrados = useMemo(() => {
    if (!data) return [];
    if (!catActiva) return data.productos;
    return data.productos.filter((p) => p.id_categoria === catActiva);
  }, [data, catActiva]);

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

  const { mesa, categorias } = data;
  const ocupada = mesa.estado === "OCUPADA";

  if (fase === "onboarding") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-6">
        <div className="w-full max-w-sm rounded-2xl border bg-card p-6 shadow-sm text-center space-y-5">
          <div className="inline-flex items-center justify-center rounded-full bg-primary/10 px-4 py-1 text-xs font-medium text-primary">
            Mesa {mesa.identificador}
          </div>
          <h1 className="text-2xl font-bold leading-tight">¡Bienvenido!</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Revisa nuestro menú y cuando tengas claro qué vas a pedir llama a tu
            mesero, te atenderemos con gusto.
          </p>
          <Button className="w-full h-12 text-base" onClick={() => setFase("menu")}>
            Continuar
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background pb-28">
      <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="px-4 pt-3 pb-2">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Mesa {mesa.identificador}
          </p>
          <h1 className="text-lg font-bold">Nuestra carta</h1>
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
          <p className="text-center text-sm text-muted-foreground py-12">
            No hay productos disponibles en esta categoría.
          </p>
        ) : (
          productosFiltrados.map((p) => <ProductoCard key={p.id_producto} p={p} />)
        )}
      </section>

      <div
        className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="mx-auto max-w-2xl p-3">
          {estadoQ.data?.tiene_pedido_activo ? (
            <div className="grid grid-cols-2 gap-2">
              <Button
                size="lg"
                variant="outline"
                className="h-14 text-base font-semibold gap-2"
                onClick={() => solicitarMut.mutate("PEDIR_MAS")}
                disabled={solicitarMut.isPending}
              >
                <Plus className="h-5 w-5" />
                Pedir más
              </Button>
              <Button
                size="lg"
                className="h-14 text-base font-semibold gap-2"
                onClick={() => solicitarMut.mutate("CUENTA")}
                disabled={solicitarMut.isPending}
              >
                <CreditCard className="h-5 w-5" />
                Pedir la cuenta
              </Button>
            </div>
          ) : (
            <Button
              size="lg"
              className="w-full h-14 text-base font-semibold gap-2"
              onClick={() => mut.mutate()}
              disabled={mut.isPending || ocupada}
              variant={ocupada ? "secondary" : "default"}
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

    </main>
  );
}

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
      className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium border transition-colors ${
        active
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-card text-foreground border-border hover:bg-muted"
      }`}
    >
      {label}
    </button>
  );
}

function ProductoCard({ p }: { p: CartaProducto }) {
  return (
    <article className="flex gap-3 rounded-xl border bg-card p-3 shadow-sm">
      <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-muted flex items-center justify-center">
        {p.url_imagen ? (
          <img src={p.url_imagen} alt={p.nombre_producto} className="h-full w-full object-cover" />
        ) : (
          <ImageIcon className="h-6 w-6 text-muted-foreground" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="font-semibold leading-tight line-clamp-1">{p.nombre_producto}</h3>
        {p.descripcion_producto && (
          <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
            {p.descripcion_producto}
          </p>
        )}
        <p className="mt-1.5 text-sm font-bold tabular-nums">{fmt.format(p.precio_venta)}</p>
      </div>
    </article>
  );
}
