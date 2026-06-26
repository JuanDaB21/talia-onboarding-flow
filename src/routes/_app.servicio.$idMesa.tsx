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
  Printer,
  Receipt,
  Search,
  Trash2,
  UserCheck,
  Utensils,
  X,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
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
  listarMeserosNegocio,
  reasignarMeseroMesa,
  getPrepedidoMesa,
  type PedidoSesion,
  type ItemPedidoSesion,
  type MesaSesion,
} from "@/lib/servicio.functions";
import { PrepedidoEnVivoCard } from "@/components/servicio/prepedido-en-vivo-card";
import { ItemEditorSheet } from "@/components/servicio/item-editor-sheet";
import { AgregarProductoSheet } from "@/components/servicio/agregar-producto-sheet";
import {
  EditarItemDialog,
  type EditarItemDialogItem,
} from "@/components/servicio/editar-item-dialog";
import { PagarSheet } from "@/components/servicio/pagar-sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMiStaff } from "@/hooks/use-mi-staff";
import { imprimirComandas, type ComandaPrintData } from "@/components/preparacion/comanda-print";
import { beepListo } from "@/components/servicio/alerta-sound";
import { LlamadoPanel } from "@/components/servicio/llamado-panel";
import { SolicitudBanner } from "@/components/servicio/solicitud-banner";
import { cerrarMesa, estadoCierreMesa } from "@/lib/pagos.functions";
import { POLL } from "@/lib/query-config";
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
import { dispatchPrintJobsForPedido } from "@/services/printService";

export const Route = createFileRoute("/_app/servicio/$idMesa")({
  head: () => ({ meta: [{ title: "Mesa en servicio" }] }),
  component: MesaEnServicio,
  errorComponent: ({ error, reset }) => (
    <div className="mx-auto max-w-md p-6 text-center space-y-3">
      <p className="text-sm text-muted-foreground">
        {error instanceof Error ? error.message : "No se pudo cargar la mesa"}
      </p>
      <div className="flex gap-2 justify-center">
        <Link to="/servicio" className="text-sm underline">Volver a mesas</Link>
        <button type="button" onClick={() => reset()} className="text-sm underline">
          Reintentar
        </button>
      </div>
    </div>
  ),
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

function imprimirComandasDePedido(
  mesaIdentificador: string,
  mesero: string | null,
  pedido: PedidoSesion,
) {
  // Agrupa los items por su destino (cualquier slug de espacio) y crea una comanda por estación.
  const grupos = new Map<string, PedidoSesion["items"]>();
  pedido.items.forEach((i) => {
    const d = (i.destino ?? "COCINA").toUpperCase();
    const arr = grupos.get(d) ?? [];
    arr.push(i);
    grupos.set(d, arr);
  });
  const comandas: ComandaPrintData[] = Array.from(grupos.entries())
    .map(([destino, items]) => ({
      destino,
      mesa_identificador: mesaIdentificador,
      pedido_id: pedido.id_pedido,
      pedido_created_at: pedido.confirmado_at ?? pedido.created_at,
      mesero,
      items: items.map((it) => ({
        cantidad: it.cantidad,
        nombre_producto: it.nombre_producto,
        tiene_alergia: it.tiene_alergia,
        nota: it.nota,
        extras: it.extras.map((e) => ({ nombre: e.nombre })),
        exclusiones: it.exclusiones.map((e) => ({ nombre: e.nombre })),
        variantes: it.variantes.map((v) => ({
          nombre_grupo: v.nombre_grupo,
          nombre_opcion: v.nombre_opcion,
        })),
      })),
    }))
    .filter((c) => c.items.length > 0);
  if (comandas.length === 0) return;
  void imprimirComandas(comandas);
}

function MesaEnServicio() {
  const { idMesa } = Route.useParams();
  const qc = useQueryClient();
  

  const getMesa = useServerFn(obtenerMesaSesion);
  const delFn = useServerFn(eliminarItem);
  const confFn = useServerFn(confirmarPedido);
  const newFn = useServerFn(iniciarNuevoPedido);
  const entregaFn = useServerFn(marcarPedidoEntregado);
  const segFn = useServerFn(marcarSeguimientoVisto);

  const mesaQ = useQuery({
    queryKey: ["mesaSesion", idMesa],
    queryFn: () => getMesa({ data: { idMesa } }),
    // Sin polling: el canal `mesa-sesion-${idMesa}` invalida en cambios reales.
    staleTime: 30_000,
  });

  // Pre-pedido en vivo (clientes armando pedido desde su celular)
  const getPrep = useServerFn(getPrepedidoMesa);
  const prepQ = useQuery({
    queryKey: ["prepedidoMesa", idMesa],
    queryFn: () => getPrep({ data: { idMesa } }),
    staleTime: 5_000,
  });

  // Realtime: refrescar cuando cambien items/pedidos/mesa/pre-pedido, y avisar cuando algo pase a LISTO
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
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "prepedido_items", filter: `id_mesa=eq.${idMesa}` },
        () => qc.invalidateQueries({ queryKey: ["prepedidoMesa", idMesa] }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "prepedido_sesiones", filter: `id_mesa=eq.${idMesa}` },
        () => qc.invalidateQueries({ queryKey: ["prepedidoMesa", idMesa] }),
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

  // La solicitud del cliente ya NO se limpia automáticamente: se muestra como
  // banner persistente y se limpia con una acción explícita del mesero.

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
    onSuccess: (_r, idPedido) => {
      toast.success("¡Orden enviada a cocina/barra!", {
        icon: <CheckCircle2 className="h-4 w-4" />,
      });
      // Print Bridge: fire-and-forget, nunca bloquea la UI ni el flujo.
      const pedido = mesaQ.data?.pedidos.find((p) => p.id_pedido === idPedido);
      if (pedido && mesaQ.data) {
        void dispatchPrintJobsForPedido({
          idPedido,
          mesaIdentificador: mesaQ.data.identificador,
          meseroNombre: mesaQ.data.mesero_nombre,
          items: pedido.items,
        });
      }
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
    ...POLL.LIVE,
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
  const [reasignarOpen, setReasignarOpen] = useState(false);

  const { rol } = useMiStaff();
  const puedeReasignar =
    rol === "MESERO" || rol === "ADMIN" || rol === "SUPERADMIN" || rol === "CAJERO";

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

      {mesa.solicitud_cliente === "LLAMADO" && (
        <LlamadoPanel
          idMesa={mesa.id_mesa}
          identificador={mesa.identificador}
          solicitudAt={mesa.solicitud_at}
        />
      )}
      {(mesa.solicitud_cliente === "CUENTA" ||
        mesa.solicitud_cliente === "PEDIR_MAS" ||
        mesa.solicitud_cliente === "TOMAR_PEDIDO") && (
        <SolicitudBanner
          idMesa={mesa.id_mesa}
          tipo={mesa.solicitud_cliente as "CUENTA" | "PEDIR_MAS" | "TOMAR_PEDIDO"}
          solicitudAt={mesa.solicitud_at}
        />
      )}


      <MesaHeader
        mesa={mesa}
        onPagar={() => setPagarOpen(true)}
        pagando={false}
        onCerrar={() => setCerrarOpen(true)}
        estado={estadoQ.data ?? null}
        onReasignar={puedeReasignar ? () => setReasignarOpen(true) : undefined}
      />

      {/* Pre-pedido en vivo (clientes armando desde el celular) */}
      {prepQ.data && prepQ.data.items.length > 0 && (
        <PrepedidoEnVivoCard idMesa={mesa.id_mesa} data={prepQ.data} />
      )}

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
          onPrint={() => imprimirComandasDePedido(mesa.identificador, mesa.mesero_nombre, p)}
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
          onPrint={() =>
            imprimirComandasDePedido(mesa.identificador, mesa.mesero_nombre, pedidoAbierto)
          }
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

      <AlertDialog open={cerrarOpen} onOpenChange={setCerrarOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cerrar y liberar la mesa?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción marcará todos los pedidos como pagados y dejará la mesa
              libre. No se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cerrarMut.isPending}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                cerrarMut.mutate();
              }}
              disabled={cerrarMut.isPending}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {cerrarMut.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <LockKeyhole className="h-4 w-4 mr-2" />
              )}
              Cerrar mesa
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ReasignarMeseroDialog
        open={reasignarOpen}
        onOpenChange={setReasignarOpen}
        idMesa={idMesa}
        meseroActualId={mesa.id_mesero_asignado}
      />
    </div>
  );
}

function MesaHeader({
  mesa,
  onPagar,
  pagando,
  onCerrar,
  estado,
  onReasignar,
}: {
  mesa: MesaSesion;
  onPagar: () => void;
  pagando: boolean;
  onCerrar: () => void;
  estado: import("@/lib/pagos.functions").EstadoCierreMesa | null;
  onReasignar?: () => void;
}) {
  const tiempo = mesa.asignada_at
    ? Math.floor((Date.now() - new Date(mesa.asignada_at).getTime()) / 60000)
    : 0;
  const hayPagar = mesa.pedidos.some((p) => p.estado !== "ABIERTO");
  const puedeCerrar = estado?.puede_cerrar ?? false;
  const motivoCerrar = !estado?.hay_pedidos
    ? "No hay pedidos activos"
    : (estado?.items_pendientes ?? 0) > 0
      ? `Faltan ${estado?.items_pendientes} items por cobrar`
      : (estado?.pagos_pendientes ?? 0) > 0
        ? `Hay ${estado?.pagos_pendientes} transferencias por confirmar`
        : "";
  return (
    <div className="rounded-2xl border bg-card p-4 sm:p-5 shadow-sm">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <Stat label="Total mesa" value={fmt.format(mesa.total_mesa)} accent />
        <Stat
          label="Tiempo en mesa"
          value={`${tiempo} min`}
          icon={<Clock className="h-4 w-4" />}
        />
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
            <UserCheck className="h-4 w-4 shrink-0" />
            <span className="truncate">Mesero</span>
          </p>
          <div className="mt-1 flex items-center gap-1 min-w-0">
            <p className="font-bold tabular-nums truncate text-base sm:text-lg min-w-0 flex-1">
              {mesa.mesero_nombre ?? "Sin asignar"}
            </p>
            {onReasignar && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs shrink-0"
                onClick={onReasignar}
              >
                Cambiar
              </Button>
            )}
          </div>
        </div>
        <Stat
          label="Pedidos activos"
          value={String(mesa.pedidos.length)}
          icon={<Utensils className="h-4 w-4" />}
        />
      </div>
      <div className="mt-4 flex flex-col sm:flex-row sm:flex-wrap sm:justify-end gap-2">
        <Button
          size="lg"
          onClick={onPagar}
          disabled={!hayPagar || pagando}
          className="gap-2 w-full sm:w-auto"
        >
          {pagando ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <CreditCard className="h-4 w-4" />
          )}
          Pagar cuenta
        </Button>
        <Button
          size="lg"
          variant={puedeCerrar ? "default" : "outline"}
          onClick={onCerrar}
          disabled={!puedeCerrar}
          title={!puedeCerrar ? motivoCerrar : "Cerrar y liberar mesa"}
          className={cn(
            "gap-2 w-full sm:w-auto",
            puedeCerrar && "bg-emerald-600 hover:bg-emerald-700 text-white",
          )}
        >
          <LockKeyhole className="h-4 w-4" />
          Cerrar mesa
        </Button>
      </div>
      {!puedeCerrar && estado?.hay_pedidos && motivoCerrar && (
        <p className="mt-2 text-right text-xs text-muted-foreground">
          {motivoCerrar}
        </p>
      )}
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
    <div className="min-w-0">
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
        {icon}
        <span className="truncate">{label}</span>
      </p>
      <p
        className={cn(
          "mt-1 font-bold tabular-nums truncate",
          accent ? "text-xl sm:text-2xl text-primary" : "text-base sm:text-lg",
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
  onPrint,
}: {
  pedido: PedidoSesion;
  numero: number;
  onEntregar: () => void;
  entregando: boolean;
  onEditItem: (it: EditarItemDialogItem) => void;
  onDeleteItem: (idItem: string) => void;
  onAddMore: () => void;
  onPrint: () => void;
}) {
  const [open, setOpen] = useState(true);
  const [vista, setVista] = useState<"detallado" | "resumen">("detallado");
  const total = pedido.items.length;
  const listos = pedido.items.filter(
    (i) => i.estado_preparacion === "LISTO" || i.estado_preparacion === "ENTREGADO",
  ).length;
  const pct = total > 0 ? Math.round((listos / total) * 100) : 0;
  const tieneAlgunEnCola = pedido.items.some((i) => i.estado_preparacion === "EN_COLA");
  const resumen = useMemo(() => agruparItemsResumen(pedido.items), [pedido.items]);
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
        className="flex items-center gap-3 p-4 cursor-pointer min-w-0"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <h3 className="font-bold truncate">Pedido #{numero}</h3>
            <Badge className={cn("font-medium", estado.cls)} variant="secondary">
              {estado.label}
            </Badge>
            {necesitaEntrega && (
              <Badge variant="default" className="bg-emerald-600 text-white animate-pulse">
                <Bell className="h-3 w-3 mr-1" /> Recoger
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 break-words">
            {formatHora(pedido.confirmado_at ?? pedido.created_at)} · {total} items ·{" "}
            <span className="font-semibold">{fmt.format(pedido.total)}</span>
          </p>
        </div>
        {open ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
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
          <div className="inline-flex rounded-md border p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setVista("detallado")}
              className={cn(
                "px-2.5 py-1 rounded-sm transition-colors",
                vista === "detallado"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Detallado
            </button>
            <button
              type="button"
              onClick={() => setVista("resumen")}
              className={cn(
                "px-2.5 py-1 rounded-sm transition-colors",
                vista === "resumen"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Resumen
            </button>
          </div>

          {vista === "detallado" ? (
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
          ) : (
            <ul className="space-y-2 divide-y">
              {resumen.map((g) => (
                <li key={g.key} className="pt-2 first:pt-0">
                  <p className="text-sm font-medium break-words">
                    {g.nombre}
                    {g.tieneModificaciones ? " (con nota)" : ""} x{g.cantidad}
                  </p>
                  {g.variantes.length > 0 && (
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {g.variantes.map((v) => `${v.nombre_grupo}: ${v.nombre_opcion}`).join(" · ")}
                    </p>
                  )}
                  {g.extras.length > 0 && (
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      + {g.extras.map((e) => e.nombre).join(", ")}
                    </p>
                  )}
                  {g.exclusiones.length > 0 && (
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Sin {g.exclusiones.map((x) => x.nombre).join(", ")}
                    </p>
                  )}
                  {g.nota && (
                    <p className="text-[11px] italic text-muted-foreground mt-0.5">
                      Nota: {g.nota}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}

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
            <Button
              variant="outline"
              size="sm"
              onClick={onPrint}
              className="gap-1"
            >
              <Printer className="h-3.5 w-3.5" /> Imprimir comanda
            </Button>
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
      <div className="flex items-start justify-between gap-2 min-w-0">
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-1.5 flex-wrap min-w-0">
            {item.tiene_alergia && (
              <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" />
            )}
            <span className="text-sm font-medium break-words min-w-0">
              {item.cantidad > 1 ? `${item.cantidad}× ` : ""}{item.nombre_producto}
            </span>

            <Badge variant="outline" className={cn("text-[10px] h-4 px-1 shrink-0", estado.cls)}>
              {estado.label}
            </Badge>
          </div>
          {item.tiene_alergia && (
            <p className="text-[11px] text-destructive font-semibold mt-0.5">
              🚨 ALERGIA
            </p>
          )}
          {item.variantes.length > 0 && (
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {item.variantes
                .map((v) => `${v.nombre_grupo}: ${v.nombre_opcion}`)
                .join(" · ")}
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

type ItemResumido = {
  key: string;
  nombre: string;
  cantidad: number;
  nota: string | null;
  extras: { nombre: string }[];
  exclusiones: { nombre: string }[];
  variantes: { nombre_grupo: string; nombre_opcion: string }[];
  tieneModificaciones: boolean;
};

function agruparItemsResumen(items: ItemPedidoSesion[]): ItemResumido[] {
  const collator = new Intl.Collator("es", { sensitivity: "base" });
  const map = new Map<string, ItemResumido>();
  for (const it of items) {
    const nota = (it.nota ?? "").trim();
    const extras = [...it.extras]
      .map((e) => ({ nombre: e.nombre }))
      .sort((a, b) => collator.compare(a.nombre, b.nombre));
    const exclusiones = [...it.exclusiones]
      .map((e) => ({ nombre: e.nombre }))
      .sort((a, b) => collator.compare(a.nombre, b.nombre));
    const variantes = [...it.variantes]
      .map((v) => ({ nombre_grupo: v.nombre_grupo, nombre_opcion: v.nombre_opcion }))
      .sort(
        (a, b) =>
          collator.compare(a.nombre_grupo, b.nombre_grupo) ||
          collator.compare(a.nombre_opcion, b.nombre_opcion),
      );
    const key = [
      it.id_producto,
      nota.toLowerCase(),
      extras.map((e) => e.nombre.toLowerCase()).join("|"),
      exclusiones.map((e) => e.nombre.toLowerCase()).join("|"),
      variantes.map((v) => `${v.nombre_grupo}:${v.nombre_opcion}`.toLowerCase()).join("|"),
    ].join("§");
    const tieneModificaciones =
      nota.length > 0 || extras.length > 0 || exclusiones.length > 0 || variantes.length > 0;
    const existing = map.get(key);
    if (existing) {
      existing.cantidad += Number(it.cantidad);
    } else {
      map.set(key, {
        key,
        nombre: it.nombre_producto,
        cantidad: Number(it.cantidad),
        nota: nota.length > 0 ? nota : null,
        extras,
        exclusiones,
        variantes,
        tieneModificaciones,
      });
    }
  }
  return Array.from(map.values()).sort((a, b) => {
    if (a.tieneModificaciones !== b.tieneModificaciones) {
      return a.tieneModificaciones ? 1 : -1;
    }
    return collator.compare(a.nombre, b.nombre);
  });
}

function PedidoAbiertoCard({
  pedido,
  mesa,
  esPrimero,
  onDelete,
  onEdit,
  onConfirm,
  confirmando,
  onPrint,
}: {
  pedido: PedidoSesion;
  mesa: MesaSesion;
  esPrimero: boolean;
  onDelete: (idItem: string) => void;
  onEdit: (it: EditarItemDialogItem) => void;
  onConfirm: () => void;
  confirmando: boolean;
  onPrint: () => void;
}) {
  const getCat = useServerFn(getCatalogoServicio);
  const catQ = useQuery({
    queryKey: ["catalogoServicio"],
    queryFn: () => getCat(),
  });
  const [catActiva, setCatActiva] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [editing, setEditing] = useState<{
    id_producto: string;
    nombre_producto: string;
    precio_venta: number;
  } | null>(null);
  const [pedidoSheetOpen, setPedidoSheetOpen] = useState(false);
  const isMobile = useIsMobile();

  const productosFiltrados = useMemo(() => {
    if (!catQ.data) return [];
    const q = busqueda.trim().normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
    return catQ.data.productos.filter((p) => {
      if (catActiva && p.id_categoria !== catActiva) return false;
      if (q) {
        const n = p.nombre_producto.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
        if (!n.includes(q)) return false;
      }
      return true;
    });
  }, [catQ.data, catActiva, busqueda]);

  const pedidoItemsList = (
    <>
      {pedido.items.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center border rounded-lg">
          Selecciona productos del catálogo.
        </p>
      ) : (
        <ul className="space-y-2 divide-y rounded-lg border bg-background p-3">
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

      <div className="flex gap-2">
        <Button
          variant="outline"
          className="h-12 gap-1"
          disabled={pedido.items.length === 0}
          onClick={onPrint}
        >
          <Printer className="h-4 w-4" />
          Imprimir
        </Button>
        <Button
          className="flex-1 h-12"
          disabled={pedido.items.length === 0 || confirmando}
          onClick={() => {
            onConfirm();
            setPedidoSheetOpen(false);
          }}
        >
          {confirmando ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            "Confirmar orden"
          )}
        </Button>
      </div>
    </>
  );

  return (
    <article className="rounded-xl border bg-card shadow-sm">
      <header className="p-4 flex items-center justify-between gap-2 border-b min-w-0">
        <div className="min-w-0">
          <h3 className="font-bold truncate">
            {esPrimero ? "Tomando pedido" : "Nueva orden en curso"}
          </h3>
          <p className="text-xs text-muted-foreground truncate">
            Catálogo abajo · {pedido.items.length} en el pedido
          </p>
        </div>
        <Badge variant="secondary" className="shrink-0">Borrador</Badge>
      </header>

      <div className="grid gap-4 lg:grid-cols-[1fr_360px] p-4">
        {/* Catálogo */}
        <section className="space-y-3 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Catálogo
            </h4>
            <span className="h-px flex-1 bg-border" />
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar producto…"
              className="pl-9 pr-9"
            />
            {busqueda && (
              <button
                type="button"
                aria-label="Limpiar búsqueda"
                onClick={() => setBusqueda("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-muted"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            )}
          </div>

          {catQ.isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {(catQ.data?.categorias.length ?? 0) > 0 && (
                <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
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

              {productosFiltrados.length === 0 ? (
                <div className="text-center py-10 border rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    {busqueda
                      ? `Sin productos para “${busqueda}”`
                      : "No hay productos en esta categoría"}
                  </p>
                  {(busqueda || catActiva) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-2"
                      onClick={() => {
                        setBusqueda("");
                        setCatActiva(null);
                      }}
                    >
                      Limpiar filtros
                    </Button>
                  )}
                </div>
              ) : (
                <div className={cn(
                  "grid grid-cols-1 sm:grid-cols-2 gap-3",
                  // dejar espacio para la barra sticky en mobile
                  isMobile && pedido.items.length > 0 && "pb-24",
                )}>
                  {productosFiltrados.map((p) => (
                    <button
                      key={p.id_producto}
                      onClick={() => setEditing(p)}
                      className="text-left rounded-xl border bg-card p-3 hover:shadow-md transition-shadow"
                    >
                      <div className="flex gap-3 min-w-0">
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
                          <h4 className="font-semibold text-sm line-clamp-2 break-words">
                            {p.nombre_producto}
                          </h4>
                          <p className="text-sm font-bold mt-1 tabular-nums">
                            {fmt.format(p.precio_venta)}
                          </p>
                        </div>
                        <Plus className="h-4 w-4 text-muted-foreground self-center shrink-0" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </section>

        {/* Aside orden — solo en desktop */}
        {!isMobile && (
          <aside className="space-y-3 h-fit lg:sticky lg:top-4 rounded-xl border bg-muted/30 p-3">
            <div className="flex items-center justify-between gap-2 px-1">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Pedido en curso
              </h4>
              <span className="text-xs font-semibold tabular-nums">
                {pedido.items.length} · {fmt.format(pedido.total)}
              </span>
            </div>
            {pedidoItemsList}
          </aside>
        )}
      </div>

      {/* Barra sticky inferior en mobile */}
      {isMobile && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 backdrop-blur p-3 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground">Pedido en curso</p>
              <p className="font-bold tabular-nums truncate">
                {pedido.items.length} items · {fmt.format(pedido.total)}
              </p>
            </div>
            <Button
              onClick={() => setPedidoSheetOpen(true)}
              className="gap-2 shrink-0"
              size="lg"
              variant={pedido.items.length === 0 ? "outline" : "default"}
            >
              <Receipt className="h-4 w-4" />
              Ver pedido
            </Button>
          </div>
        </div>
      )}

      <Sheet open={pedidoSheetOpen} onOpenChange={setPedidoSheetOpen}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Pedido en curso</SheetTitle>
            <SheetDescription>
              {pedido.items.length} items · {fmt.format(pedido.total)}
            </SheetDescription>
          </SheetHeader>
          <div className="mt-4 space-y-3">
            {pedidoItemsList}
          </div>
        </SheetContent>
      </Sheet>

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

function ReasignarMeseroDialog({
  open,
  onOpenChange,
  idMesa,
  meseroActualId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  idMesa: string;
  meseroActualId: string | null;
}) {
  const qc = useQueryClient();
  const listFn = useServerFn(listarMeserosNegocio);
  const reasFn = useServerFn(reasignarMeseroMesa);
  const [sel, setSel] = useState<string>("");

  const meserosQ = useQuery({
    queryKey: ["meseros-negocio"],
    queryFn: () => listFn(),
    enabled: open,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (open) setSel(meseroActualId ?? "");
  }, [open, meseroActualId]);

  const mut = useMutation({
    mutationFn: (idMesero: string) => reasFn({ data: { idMesa, idMesero } }),
    onSuccess: () => {
      toast.success("Mesero reasignado");
      qc.invalidateQueries({ queryKey: ["mesaSesion", idMesa] });
      qc.invalidateQueries({ queryKey: ["mesasServicio"] });
      onOpenChange(false);
    },
    onError: (e) =>
      toast.error("No se pudo reasignar", {
        description: e instanceof Error ? e.message : undefined,
      }),
  });

  const meseros = meserosQ.data ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reasignar mesero</DialogTitle>
          <DialogDescription>
            Selecciona el mesero que tomará esta mesa.
          </DialogDescription>
        </DialogHeader>
        {meserosQ.isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : meseros.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">
            No hay meseros activos disponibles.
          </p>
        ) : (
          <Select value={sel} onValueChange={setSel}>
            <SelectTrigger>
              <SelectValue placeholder="Selecciona un mesero" />
            </SelectTrigger>
            <SelectContent>
              {meseros.map((m) => (
                <SelectItem key={m.id_usuario} value={m.id_usuario}>
                  {m.nombre}
                  {m.esta_en_turno ? "" : " (fuera de turno)"}
                  {m.id_usuario === meseroActualId ? " · actual" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={mut.isPending}
          >
            Cancelar
          </Button>
          <Button
            onClick={() => sel && mut.mutate(sel)}
            disabled={!sel || sel === meseroActualId || mut.isPending}
          >
            {mut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Reasignar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

