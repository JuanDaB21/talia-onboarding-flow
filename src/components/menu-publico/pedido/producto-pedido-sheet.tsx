import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, ImageIcon, Loader2, Minus, Plus, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import type { CartaProducto } from "@/lib/menu-publico.functions";
import { getOpcionesProductoCarta } from "@/lib/domicilios-publico.functions";
import { formatMoney } from "@/lib/format";
import { publicUrl } from "@/lib/storage";
import { TextoFijo } from "@/components/menu-publico/texto-fijo";
import type { NuevaLinea } from "./carrito";

/**
 * Detalle de producto en modo pedido: variantes (UNICA = obligatoria), adiciones, quitar
 * ingredientes, nota y cantidad. Se carga diferido (solo al tocar un producto).
 */
export default function ProductoPedidoSheet({
  idNegocio,
  producto,
  themeStyle,
  onClose,
  onAgregar,
}: {
  idNegocio: string;
  producto: CartaProducto | null;
  themeStyle: React.CSSProperties;
  onClose: () => void;
  onAgregar: (l: NuevaLinea) => void;
}) {
  const open = producto !== null;
  const { data: opciones, isLoading } = useQuery({
    queryKey: ["carta-publica", "opciones", idNegocio, producto?.id_producto],
    queryFn: () => getOpcionesProductoCarta(idNegocio, producto!.id_producto),
    enabled: open,
    staleTime: 60_000,
  });

  const [cantidad, setCantidad] = useState(1);
  const [nota, setNota] = useState("");
  const [variantes, setVariantes] = useState<Map<string, Set<string>>>(new Map());
  const [extras, setExtras] = useState<Set<string>>(new Set());
  const [exclus, setExclus] = useState<Set<string>>(new Set());

  useEffect(() => {
    setCantidad(1);
    setNota("");
    setVariantes(new Map());
    setExtras(new Set());
    setExclus(new Set());
  }, [producto?.id_producto]);

  const faltan = useMemo(
    () =>
      (opciones?.variantes ?? []).filter(
        (g) => g.seleccion === "UNICA" && g.opciones.length > 0 && !variantes.get(g.id_grupo)?.size,
      ),
    [opciones, variantes],
  );

  const unitario = useMemo(() => {
    if (!producto) return 0;
    let u = Number(producto.precio_venta);
    for (const g of opciones?.variantes ?? [])
      for (const o of g.opciones)
        if (variantes.get(g.id_grupo)?.has(o.id_opcion)) u += o.precio_delta;
    for (const e of opciones?.extras ?? []) if (extras.has(e.id_insumo_extra)) u += e.precio_extra;
    return u;
  }, [producto, opciones, variantes, extras]);

  function toggleVariante(idGrupo: string, idOpcion: string, unica: boolean) {
    setVariantes((m) => {
      const n = new Map(m);
      const next = new Set(n.get(idGrupo) ?? []);
      if (unica) {
        next.clear();
        next.add(idOpcion);
      } else if (next.has(idOpcion)) next.delete(idOpcion);
      else next.add(idOpcion);
      n.set(idGrupo, next);
      return n;
    });
  }
  const toggle = (set: React.Dispatch<React.SetStateAction<Set<string>>>, id: string) =>
    set((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  function agregar() {
    if (!producto || !opciones || faltan.length > 0) return;
    onAgregar({
      id_producto: producto.id_producto,
      nombre: producto.nombre_producto,
      url_imagen: producto.url_imagen,
      precio_unitario: unitario,
      cantidad,
      nota,
      variantes: opciones.variantes.flatMap((g) =>
        g.opciones
          .filter((o) => variantes.get(g.id_grupo)?.has(o.id_opcion))
          .map((o) => ({
            id_opcion: o.id_opcion,
            nombre: o.nombre_opcion,
            precio_delta: o.precio_delta,
          })),
      ),
      extras: opciones.extras
        .filter((e) => extras.has(e.id_insumo_extra))
        .map((e) => ({
          id_insumo_extra: e.id_insumo_extra,
          nombre: e.nombre_insumo,
          precio: e.precio_extra,
        })),
      exclusiones: opciones.ingredientes
        .filter((i) => exclus.has(i.id_insumo))
        .map((i) => ({ id_insumo: i.id_insumo, nombre: i.nombre_insumo })),
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="max-h-[92vh] max-w-md gap-0 overflow-hidden border-0 p-0 [&>button.absolute]:hidden"
        style={{
          ...themeStyle,
          background: "var(--menu-surface)",
          color: "var(--menu-foreground)",
          fontFamily: "var(--menu-body-font)",
          borderRadius: "var(--menu-radius)",
        }}
      >
        {producto && (
          <div className="flex max-h-[92vh] flex-col">
            <div className="relative min-h-0 flex-1 overflow-y-auto">
              <button
                type="button"
                onClick={onClose}
                className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full backdrop-blur"
                style={{ background: "color-mix(in oklab, var(--menu-bg) 80%, transparent)" }}
                aria-label="Cerrar"
              >
                <X className="h-5 w-5" />
              </button>
              <div
                className="flex w-full items-center justify-center overflow-hidden"
                style={{ background: "var(--menu-surface-2)", aspectRatio: "16 / 10" }}
              >
                {producto.url_imagen ? (
                  <img
                    src={publicUrl(producto.url_imagen) ?? undefined}
                    alt={producto.nombre_producto}
                    decoding="async"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <ImageIcon className="h-14 w-14" style={{ color: "var(--menu-muted)" }} />
                )}
              </div>

              <div className="space-y-5 px-5 pb-6 pt-5">
                <div className="space-y-1.5">
                  <DialogTitle
                    className="text-2xl font-bold leading-tight"
                    style={{ fontFamily: "var(--menu-heading-font)" }}
                  >
                    <TextoFijo texto={producto.nombre_producto} />
                  </DialogTitle>
                  <p className="text-lg font-semibold" style={{ color: "var(--menu-primary)" }}>
                    {formatMoney(Number(producto.precio_venta))}
                  </p>
                  <DialogDescription
                    className="text-sm leading-relaxed"
                    style={{ color: "var(--menu-muted)" }}
                  >
                    {producto.descripcion_producto || ""}
                  </DialogDescription>
                </div>

                {isLoading ? (
                  <Loader2
                    className="h-5 w-5 animate-spin"
                    style={{ color: "var(--menu-muted)" }}
                  />
                ) : (
                  <>
                    {opciones?.variantes.map((g) => {
                      const unica = g.seleccion === "UNICA";
                      return (
                        <Grupo
                          key={g.id_grupo}
                          titulo={g.nombre}
                          ayuda={
                            unica ? "Obligatorio · elige 1" : "Opcional · puedes elegir varias"
                          }
                          pendiente={unica && faltan.some((f) => f.id_grupo === g.id_grupo)}
                        >
                          {g.opciones.map((o) => (
                            <Opcion
                              key={o.id_opcion}
                              redonda={unica}
                              activa={!!variantes.get(g.id_grupo)?.has(o.id_opcion)}
                              onClick={() => toggleVariante(g.id_grupo, o.id_opcion, unica)}
                              label={o.nombre_opcion}
                              precio={o.precio_delta}
                            />
                          ))}
                        </Grupo>
                      );
                    })}

                    {opciones && opciones.extras.length > 0 && (
                      <Grupo titulo="Adiciones" ayuda="Opcional">
                        {opciones.extras.map((e) => (
                          <Opcion
                            key={e.id_insumo_extra}
                            activa={extras.has(e.id_insumo_extra)}
                            onClick={() => toggle(setExtras, e.id_insumo_extra)}
                            label={e.nombre_insumo}
                            precio={e.precio_extra}
                          />
                        ))}
                      </Grupo>
                    )}

                    {opciones &&
                      opciones.permite_quitar_ingredientes &&
                      opciones.ingredientes.length > 0 && (
                        <Grupo titulo="¿Quitamos algo?" ayuda="Toca lo que NO quieres">
                          <div className="flex flex-wrap gap-2">
                            {opciones.ingredientes.map((i) => {
                              const quitado = exclus.has(i.id_insumo);
                              return (
                                <button
                                  key={i.id_insumo}
                                  type="button"
                                  onClick={() => toggle(setExclus, i.id_insumo)}
                                  className="rounded-full px-3 py-1.5 text-xs font-medium transition-colors"
                                  style={{
                                    border: "1px solid var(--menu-border)",
                                    background: quitado ? "var(--menu-foreground)" : "transparent",
                                    color: quitado
                                      ? "var(--menu-surface)"
                                      : "var(--menu-foreground)",
                                    textDecoration: quitado ? "line-through" : undefined,
                                  }}
                                >
                                  {i.nombre_insumo}
                                </button>
                              );
                            })}
                          </div>
                        </Grupo>
                      )}

                    <div className="space-y-2">
                      <label htmlFor="nota-prod" className="text-sm font-semibold">
                        Instrucciones especiales
                      </label>
                      <textarea
                        id="nota-prod"
                        rows={2}
                        maxLength={300}
                        value={nota}
                        onChange={(e) => setNota(e.target.value)}
                        placeholder="Ej. sin cebolla, salsa aparte…"
                        className="w-full resize-none px-3 py-2 text-sm outline-none focus:ring-2"
                        style={{
                          background: "var(--menu-bg)",
                          border: "1px solid var(--menu-border)",
                          borderRadius: "var(--menu-radius)",
                        }}
                      />
                    </div>
                  </>
                )}
              </div>
            </div>

            <div
              className="flex items-center gap-3 px-5 py-4"
              style={{
                borderTop: "1px solid var(--menu-border)",
                background: "var(--menu-surface)",
              }}
            >
              <Stepper valor={cantidad} onChange={setCantidad} />
              <button
                type="button"
                disabled={isLoading || !opciones || faltan.length > 0}
                onClick={agregar}
                className="flex h-12 flex-1 items-center justify-between gap-2 px-4 text-sm font-semibold transition-opacity disabled:opacity-50"
                style={{
                  background: "var(--menu-primary)",
                  color: "var(--menu-primary-foreground)",
                  borderRadius: "var(--menu-radius)",
                }}
              >
                <span>
                  {faltan.length > 0 ? `Elige ${faltan[0].nombre.toLowerCase()}` : "Agregar"}
                </span>
                <span>{formatMoney(unitario * cantidad)}</span>
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Grupo({
  titulo,
  ayuda,
  pendiente,
  children,
}: {
  titulo: string;
  ayuda: string;
  pendiente?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold">{titulo}</h3>
        <span
          className="text-[11px] font-medium"
          style={{ color: pendiente ? "var(--menu-primary)" : "var(--menu-muted)" }}
        >
          {ayuda}
        </span>
      </div>
      <div className="space-y-1.5">{children}</div>
    </section>
  );
}

function Opcion({
  activa,
  onClick,
  label,
  precio,
  redonda,
}: {
  activa: boolean;
  onClick: () => void;
  label: string;
  precio: number;
  redonda?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activa}
      className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm transition-colors"
      style={{
        border: `1px solid ${activa ? "var(--menu-primary)" : "var(--menu-border)"}`,
        background: activa
          ? "color-mix(in oklab, var(--menu-primary) 10%, transparent)"
          : "transparent",
        borderRadius: "var(--menu-radius)",
      }}
    >
      <span
        className={`flex h-5 w-5 shrink-0 items-center justify-center ${redonda ? "rounded-full" : "rounded-md"}`}
        style={{
          border: `1.5px solid ${activa ? "var(--menu-primary)" : "var(--menu-border)"}`,
          background: activa ? "var(--menu-primary)" : "transparent",
          color: "var(--menu-primary-foreground)",
        }}
      >
        {activa && <Check className="h-3 w-3" strokeWidth={3} />}
      </span>
      <span className="flex-1">{label}</span>
      {precio > 0 && <span style={{ color: "var(--menu-muted)" }}>+{formatMoney(precio)}</span>}
    </button>
  );
}

export function Stepper({
  valor,
  onChange,
  min = 1,
  max = 20,
  compacto,
}: {
  valor: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  compacto?: boolean;
}) {
  const h = compacto ? "h-8 w-8" : "h-12 w-11";
  return (
    <div
      className="flex items-center"
      style={{ border: "1px solid var(--menu-border)", borderRadius: "var(--menu-radius)" }}
    >
      <button
        type="button"
        aria-label="Quitar uno"
        className={`flex ${h} items-center justify-center disabled:opacity-40`}
        disabled={valor <= min}
        onClick={() => onChange(valor - 1)}
      >
        <Minus className="h-4 w-4" />
      </button>
      <span className="w-6 text-center text-sm font-semibold tabular-nums">{valor}</span>
      <button
        type="button"
        aria-label="Agregar uno"
        className={`flex ${h} items-center justify-center disabled:opacity-40`}
        disabled={valor >= max}
        onClick={() => onChange(valor + 1)}
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}
