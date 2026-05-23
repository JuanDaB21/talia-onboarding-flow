import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowLeft,
  Bell,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  CreditCard,
  ImageIcon,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  UserCheck,
  Utensils,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import {
  obtenerMesaSesion,
  getCatalogoServicio,
  eliminarItem,
  confirmarPedido,
  iniciarNuevoPedido,
  marcarPedidoEntregado,
  marcarSeguimientoVisto,
  limpiarSolicitudCliente,
  type PedidoSesion,
  type ItemPedidoSesion,
  type MesaSesion,
} from "@/lib/servicio.functions";
import { ItemEditorSheet } from "@/components/servicio/item-editor-sheet";
import { AgregarProductoSheet } from "@/components/servicio/agregar-producto-sheet";
import {
  EditarItemDialog,
  type EditarItemDialogItem,
} from "@/components/servicio/editar-item-dialog";
import { PagarSheet } from "@/components/servicio/pagar-sheet";
import { beepListo } from "@/components/servicio/alerta-sound";
import { cerrarMesa, estadoCierreMesa } from "@/lib/pagos.functions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useNavigate } from "@tanstack/react-router";
import { LockKeyhole } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/servicio/$idMesa")({
  head: () => ({ meta: [{ title: "Mesa en servicio" }] }),
  component: MesaEnServicio,
});

const fmt = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

function formatHora(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleTimeString("es-CO", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function MesaEnServicio() {
  const { idMesa } = Route.useParams();
  const qc = useQueryClient();
  

  const getMesa = useServerFn(obtenerMesaSesion);
  const delFn = useServerFn(eliminarItem);
  const confFn = useServerFn(confirmarPedido);
  const newFn = useServerFn(iniciarNuevoPedido);
  const entregaFn = useServerFn(marcarPedidoEntregado);
  const limpiarSolFn = useServerFn(limpiarSolicitudCliente);
  const segFn = useServerFn(marcarSeguimientoVisto);

  const mesaQ = useQuery({
    queryKey: ["mesaSesion", idMesa],
    queryFn: () => getMesa({ data: { idMesa } }),
    refetchInterval: 30_000,
  });

  // Realtime: refrescar cuando cambien items/pedidos/mesa, y avisar cuando algo pase a LISTO
  useEffect(() => {
    const ch = supabase
      .channel(`mesa-sesion-${idMesa}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pedido_items" },
        () => qc.invalidateQueries({ queryKey: ["mesaSesion", idMesa] }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pedidos", filter: `id_mesa=eq.${idMesa}` },
        () => qc.invalidateQueries({ queryKey: ["mesaSesion", idMesa] }),
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "mesas", filter: `id_mesa=eq.${idMesa}` },
        () => qc.invalidateQueries({ queryKey: ["mesaSesion", idMesa] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [idMesa, qc]);

  // Avisar cuando un pedido pasa a LISTO (alerta de recogida)
  const prevListos = useState<Set<string>>(() => new Set<string>())[0];
  useEffect(() => {
    if (!mesaQ.data) return;
    for (const p of mesaQ.data.pedidos) {
      if (p.estado_global === "LISTO" && !prevListos.has(p.id_pedido)) {
        prevListos.add(p.id_pedido);
        beepListo();
        toast.success("Pedido listo para recoger", {
          icon: <Bell className="h-4 w-4" />,
        });
      } else if (p.estado_global !== "LISTO") {
        prevListos.delete(p.id_pedido);
      }
    }
  }, [mesaQ.data, prevListos]);

  // Tick visual del tiempo de servicio
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  // Si la mesa tenía solicitud del cliente, mostrar y limpiar
  useEffect(() => {
    if (!mesaQ.data?.solicitud_cliente) return;
    const tipo = mesaQ.data.solicitud_cliente;
    toast.info(
      tipo === "CUENTA"
        ? "🧾 El cliente pide la cuenta"
        : "➕ El cliente quiere pedir más",
      { duration: 8000 },
    );
    limpiarSolFn({ data: { idMesa } }).catch(() => undefined);
  }, [mesaQ.data?.solicitud_cliente, idMesa, limpiarSolFn]);

  // Marcar seguimiento visto al entrar (los pedidos entregados >30min)
  useEffect(() => {
    if (!mesaQ.data) return;
    const ahora = Date.now();
    for (const p of mesaQ.data.pedidos) {
      if (
        p.entregado_at &&
        !p.seguimiento_visto_at &&
        ahora - new Date(p.entregado_at).getTime() > 30 * 60 * 1000
      ) {
        segFn({ data: { idPedido: p.id_pedido } }).catch(() => undefined);
      }
    }
  }, [mesaQ.data, segFn]);

  const delMut = useMutation({
    mutationFn: (idItem: string) => delFn({ data: { idItem } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mesaSesion", idMesa] });
      toast.success("Item eliminado");
    },
    onError: (e) =>
      toast.error("No se pudo eliminar", {
        description: e instanceof Error ? e.message : undefined,
      }),
  });

  const confMut = useMutation({
    mutationFn: (idPedido: string) => confFn({ data: { idPedido } }),
    onSuccess: () => {
      toast.success("¡Orden enviada a cocina/barra!", {
        icon: <CheckCircle2 className="h-4 w-4" />,
      });
      qc.invalidateQueries({ queryKey: ["mesaSesion", idMesa] });
    },
    onError: (e) =>
      toast.error("No se pudo confirmar", {
        description: e instanceof Error ? e.message : undefined,
      }),
  });

  const newMut = useMutation({
    mutationFn: () => newFn({ data: { idMesa } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mesaSesion", idMesa] });
      toast.success("Nuevo pedido creado");
    },
    onError: (e) =>
      toast.error("No se pudo crear el pedido", {
        description: e instanceof Error ? e.message : undefined,
      }),
  });

  const entMut = useMutation({
    mutationFn: (idPedido: string) => entregaFn({ data: { idPedido } }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["mesaSesion", idMesa] });
      toast.success(`Entregados ${r.entregados} items`);
    },
    onError: (e) =>
      toast.error("No se pudo marcar entrega", {
        description: e instanceof Error ? e.message : undefined,
      }),
  });

  const [pagarOpen, setPagarOpen] = useState(false);
  const [cerrarOpen, setCerrarOpen] = useState(false);
  const navigate = useNavigate();

  const estadoFn = useServerFn(estadoCierreMesa);
  const estadoQ = useQuery({
    queryKey: ["estadoCierre", idMesa],
    queryFn: () => estadoFn({ data: { idMesa } }),
    refetchInterval: 15_000,
  });

  const cerrarFn = useServerFn(cerrarMesa);
  const cerrarMut = useMutation({
    mutationFn: () => cerrarFn({ data: { idMesa } }),
    onSuccess: () => {
      toast.success("Mesa cerrada y liberada");
      setCerrarOpen(false);
      navigate({ to: "/servicio" });
    },
    onError: (e) =>
      toast.error("No se pudo cerrar la mesa", {
        description: e instanceof Error ? e.message : undefined,
      }),
  });

  const [editing, setEditing] = useState<EditarItemDialogItem | null>(null);
  const [addingTo, setAddingTo] = useState<string | null>(null);

  if (mesaQ.isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (mesaQ.isError || !mesaQ.data) {
    return (
      <p className="text-sm text-destructive">
        No se pudo cargar la mesa.{" "}
        <Link to="/servicio" className="underline">
          Volver
        </Link>
      </p>
    );
  }

  const mesa = mesaQ.data;
  const pedidoAbierto = mesa.pedidos.find((p) => p.estado === "ABIERTO");
  const pedidosConfirmados = mesa.pedidos.filter((p) => p.estado === "CONFIRMADO");
  const hayConfirmados = pedidosConfirmados.length > 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon">
          <Link to="/servicio">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            Mesa
          </p>
          <h1 className="text-2xl font-bold">{mesa.identificador}</h1>
        </div>
      </div>

      <MesaHeader
        mesa={mesa}
        onPagar={() => setPagarOpen(true)}
        pagando={false}
        onCerrar={() => setCerrarOpen(true)}
        estado={estadoQ.data ?? null}
      />

      {/* Pedidos confirmados */}
      {pedidosConfirmados.map((p, idx) => (
        <PedidoConfirmadoCard
          key={p.id_pedido}
          pedido={p}
          numero={idx + 1}
          onEntregar={() => entMut.mutate(p.id_pedido)}
          entregando={entMut.isPending}
          onEditItem={(it) => setEditing(it)}
          onDeleteItem={(idItem) => delMut.mutate(idItem)}
          onAddMore={() => setAddingTo(p.id_pedido)}
        />
      ))}

      {/* Pedido abierto (toma activa) */}
      {pedidoAbierto && (
        <PedidoAbiertoCard
          pedido={pedidoAbierto}
          mesa={mesa}
          esPrimero={!hayConfirmados}
          onDelete={(idItem) => delMut.mutate(idItem)}
          onEdit={(it) => setEditing(it)}
          onConfirm={() => confMut.mutate(pedidoAbierto.id_pedido)}
          confirmando={confMut.isPending}
        />
      )}

      {/* Botón nuevo pedido (solo si no hay abierto y hay confirmados) */}
      {!pedidoAbierto && hayConfirmados && (
        <Button
          variant="outline"
          className="w-full h-14 border-dashed"
          onClick={() => newMut.mutate()}
          disabled={newMut.isPending}
        >
          {newMut.isPending ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <>
              <Plus className="h-5 w-5 mr-2" />
              Agregar productos (nueva orden)
            </>
          )}
        </Button>
      )}

      {/* Diálogos */}
      <EditarItemDialog
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
        item={editing}
      />
      <AgregarProductoSheet
        open={!!addingTo}
        onOpenChange={(o) => !o && setAddingTo(null)}
        idPedido={addingTo ?? ""}
        titulo="Agregar a la comanda"
      />

      <PagarSheet open={pagarOpen} onOpenChange={setPagarOpen} idMesa={idMesa} />
    </div>
  );
}

function MesaHeader({
  mesa,
  onPagar,
  pagando,
}: {
  mesa: MesaSesion;
  onPagar: () => void;
  pagando: boolean;
}) {
  const tiempo = mesa.asignada_at
    ? Math.floor((Date.now() - new Date(mesa.asignada_at).getTime()) / 60000)
    : 0;
  const hayPagar = mesa.pedidos.some((p) => p.estado !== "ABIERTO");
  return (
    <div className="rounded-2xl border bg-card p-5 shadow-sm">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat
          label="Total mesa"
          value={fmt.format(mesa.total_mesa)}
          accent
        />
        <Stat
          label="Tiempo en mesa"
          value={`${tiempo} min`}
          icon={<Clock className="h-4 w-4" />}
        />
        <Stat
          label="Mesero"
          value={mesa.mesero_nombre ?? "Sin asignar"}
          icon={<UserCheck className="h-4 w-4" />}
        />
        <Stat
          label="Pedidos activos"
          value={String(mesa.pedidos.length)}
          icon={<Utensils className="h-4 w-4" />}
        />
      </div>
      <div className="mt-4 flex justify-end">
        <Button
          size="lg"
          onClick={onPagar}
          disabled={!hayPagar || pagando}
          className="gap-2"
        >
          {pagando ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <CreditCard className="h-4 w-4" />
          )}
          Pagar cuenta
        </Button>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
        {icon}
        {label}
      </p>
      <p
        className={cn(
          "mt-1 font-bold tabular-nums truncate",
          accent ? "text-2xl text-primary" : "text-lg",
        )}
      >
        {value}
      </p>
    </div>
  );
}

const ESTADO_LABEL: Record<string, { label: string; cls: string }> = {
  EN_COLA: { label: "En cola", cls: "bg-muted text-foreground" },
  EN_PREPARACION: {
    label: "En preparación",
    cls: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  },
  LISTO: {
    label: "Listo para recoger",
    cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  },
  ENTREGADO: {
    label: "Entregado",
    cls: "bg-primary/15 text-primary",
  },
  ABIERTO: { label: "Tomando pedido", cls: "bg-muted text-foreground" },
};

function PedidoConfirmadoCard({
  pedido,
  numero,
  onEntregar,
  entregando,
  onEditItem,
  onDeleteItem,
  onAddMore,
}: {
  pedido: PedidoSesion;
  numero: number;
  onEntregar: () => void;
  entregando: boolean;
  onEditItem: (it: EditarItemDialogItem) => void;
  onDeleteItem: (idItem: string) => void;
  onAddMore: () => void;
}) {
  const [open, setOpen] = useState(true);
  const total = pedido.items.length;
  const listos = pedido.items.filter(
    (i) => i.estado_preparacion === "LISTO" || i.estado_preparacion === "ENTREGADO",
  ).length;
  const pct = total > 0 ? Math.round((listos / total) * 100) : 0;
  const tieneAlgunEnCola = pedido.items.some((i) => i.estado_preparacion === "EN_COLA");
  const estado = ESTADO_LABEL[pedido.estado_global] ?? ESTADO_LABEL.EN_COLA;
  const necesitaEntrega = pedido.estado_global === "LISTO";

  return (
    <article
      className={cn(
        "rounded-xl border bg-card shadow-sm overflow-hidden",
        necesitaEntrega && "ring-2 ring-emerald-500",
      )}
    >
      <header
        className="flex items-center gap-3 p-4 cursor-pointer"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-bold">Pedido #{numero}</h3>
            <Badge className={cn("font-medium", estado.cls)} variant="secondary">
              {estado.label}
            </Badge>
            {necesitaEntrega && (
              <Badge variant="default" className="bg-emerald-600 text-white animate-pulse">
                <Bell className="h-3 w-3 mr-1" /> Recoger
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {formatHora(pedido.confirmado_at ?? pedido.created_at)} · {total} items ·{" "}
            <span className="font-semibold">{fmt.format(pedido.total)}</span>
          </p>
        </div>
        {open ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </header>

      <div className="px-4">
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="text-muted-foreground">
            {listos} / {total} listos
          </span>
          <span className="text-muted-foreground">{pct}%</span>
        </div>
        <Progress value={pct} className="h-1.5" />
      </div>

      {open && (
        <div className="p-4 space-y-3">
          <ul className="space-y-2 divide-y">
            {pedido.items.map((it) => (
              <ItemRow
                key={it.id_item}
                item={it}
                onEdit={onEditItem}
                onDelete={onDeleteItem}
              />
            ))}
          </ul>

          <div className="flex flex-wrap gap-2 pt-2 border-t">
            {tieneAlgunEnCola && (
              <Button
                variant="outline"
                size="sm"
                onClick={onAddMore}
                className="gap-1"
              >
                <Plus className="h-3.5 w-3.5" /> Agregar producto
              </Button>
            )}
            {necesitaEntrega && (
              <Button
                size="sm"
                onClick={onEntregar}
                disabled={entregando}
                className="gap-1 ml-auto bg-emerald-600 hover:bg-emerald-700"
              >
                {entregando ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                )}
                Confirmar entrega
              </Button>
            )}
          </div>
        </div>
      )}
    </article>
  );
}

function ItemRow({
  item,
  onEdit,
  onDelete,
}: {
  item: ItemPedidoSesion;
  onEdit: (it: EditarItemDialogItem) => void;
  onDelete: (idItem: string) => void;
}) {
  const enCola = item.estado_preparacion === "EN_COLA";
  const estado = ESTADO_LABEL[item.estado_preparacion] ?? ESTADO_LABEL.EN_COLA;
  return (
    <li className="pt-2 first:pt-0">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            {item.tiene_alergia && (
              <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />
            )}
            <span className="text-sm font-medium">
              {item.cantidad}× {item.nombre_producto}
            </span>
            <Badge variant="outline" className={cn("text-[10px] h-4 px-1", estado.cls)}>
              {estado.label}
            </Badge>
          </div>
          {item.tiene_alergia && (
            <p className="text-[11px] text-destructive font-semibold mt-0.5">
              🚨 ALERGIA
            </p>
          )}
          {item.extras.length > 0 && (
            <p className="text-[11px] text-muted-foreground mt-0.5">
              + {item.extras.map((e) => e.nombre).join(", ")}
            </p>
          )}
          {item.exclusiones.length > 0 && (
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Sin {item.exclusiones.map((x) => x.nombre).join(", ")}
            </p>
          )}
          {item.nota && (
            <p className="text-[11px] italic text-muted-foreground mt-0.5">
              "{item.nota}"
            </p>
          )}
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm font-semibold tabular-nums">
            {fmt.format(item.cantidad * item.precio_unitario)}
          </p>
          <div className="flex justify-end gap-0.5 mt-0.5">
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              disabled={!enCola}
              title={enCola ? "Editar" : "Ya está en preparación"}
              onClick={() =>
                onEdit({
                  id_item: item.id_item,
                  nombre_producto: item.nombre_producto,
                  cantidad: item.cantidad,
                  tiene_alergia: item.tiene_alergia,
                  nota: item.nota,
                })
              }
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-destructive"
              disabled={!enCola}
              title={enCola ? "Eliminar" : "Ya está en preparación"}
              onClick={() => onDelete(item.id_item)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </li>
  );
}

function PedidoAbiertoCard({
  pedido,
  mesa,
  esPrimero,
  onDelete,
  onEdit,
  onConfirm,
  confirmando,
}: {
  pedido: PedidoSesion;
  mesa: MesaSesion;
  esPrimero: boolean;
  onDelete: (idItem: string) => void;
  onEdit: (it: EditarItemDialogItem) => void;
  onConfirm: () => void;
  confirmando: boolean;
}) {
  const getCat = useServerFn(getCatalogoServicio);
  const catQ = useQuery({
    queryKey: ["catalogoServicio"],
    queryFn: () => getCat(),
  });
  const [catActiva, setCatActiva] = useState<string | null>(null);
  const [editing, setEditing] = useState<{
    id_producto: string;
    nombre_producto: string;
    precio_venta: number;
  } | null>(null);

  const productosFiltrados = useMemo(() => {
    if (!catQ.data) return [];
    if (!catActiva) return catQ.data.productos;
    return catQ.data.productos.filter((p) => p.id_categoria === catActiva);
  }, [catQ.data, catActiva]);

  return (
    <article className="rounded-xl border bg-card shadow-sm">
      <header className="p-4 flex items-center justify-between border-b">
        <div>
          <h3 className="font-bold">
            {esPrimero ? "Tomando pedido" : "Nueva orden en curso"}
          </h3>
          <p className="text-xs text-muted-foreground">
            {pedido.items.length} items · {fmt.format(pedido.total)}
          </p>
        </div>
        <Badge variant="secondary">Borrador</Badge>
      </header>

      <div className="grid gap-4 lg:grid-cols-[1fr_360px] p-4">
        {/* Catálogo */}
        <div className="space-y-3">
          {catQ.isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {(catQ.data?.categorias.length ?? 0) > 0 && (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  <PillBtn
                    active={catActiva === null}
                    onClick={() => setCatActiva(null)}
                  >
                    Todo
                  </PillBtn>
                  {catQ.data!.categorias.map((c) => (
                    <PillBtn
                      key={c.id_categoria}
                      active={catActiva === c.id_categoria}
                      onClick={() => setCatActiva(c.id_categoria)}
                    >
                      {c.nombre}{" "}
                      <span className="ml-1 text-[10px] opacity-70">
                        {c.destino === "BARRA" ? "🍷" : "🍳"}
                      </span>
                    </PillBtn>
                  ))}
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {productosFiltrados.map((p) => (
                  <button
                    key={p.id_producto}
                    onClick={() => setEditing(p)}
                    className="text-left rounded-xl border bg-card p-3 hover:shadow-md transition-shadow"
                  >
                    <div className="flex gap-3">
                      <div className="h-14 w-14 shrink-0 rounded-lg bg-muted flex items-center justify-center overflow-hidden">
                        {p.url_imagen ? (
                          <img
                            src={p.url_imagen}
                            alt={p.nombre_producto}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <ImageIcon className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="font-semibold text-sm line-clamp-1">
                          {p.nombre_producto}
                        </h4>
                        <p className="text-sm font-bold mt-1 tabular-nums">
                          {fmt.format(p.precio_venta)}
                        </p>
                      </div>
                      <Plus className="h-4 w-4 text-muted-foreground self-center" />
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Aside orden */}
        <aside className="space-y-3 h-fit">
          {pedido.items.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center border rounded-lg">
              Selecciona productos del catálogo.
            </p>
          ) : (
            <ul className="space-y-2 divide-y rounded-lg border p-3">
              {pedido.items.map((it) => (
                <ItemRow
                  key={it.id_item}
                  item={it}
                  onEdit={onEdit}
                  onDelete={onDelete}
                />
              ))}
            </ul>
          )}

          <Button
            className="w-full h-12"
            disabled={pedido.items.length === 0 || confirmando}
            onClick={onConfirm}
          >
            {confirmando ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Confirmar orden"
            )}
          </Button>
        </aside>
      </div>

      <ItemEditorSheet
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
        producto={editing}
        idPedido={pedido.id_pedido}
      />
      {/* mesa prop reservada para futuros badges (alergias previas, etc.) */}
      <span className="hidden">{mesa.id_mesa}</span>
    </article>
  );
}

function PillBtn({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm border transition-colors ${
        active
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-card border-border hover:bg-muted"
      }`}
    >
      {children}
    </button>
  );
}
