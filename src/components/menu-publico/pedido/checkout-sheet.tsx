import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  Banknote,
  Bike,
  Check,
  Copy,
  Landmark,
  Loader2,
  Paperclip,
  ShoppingBag,
  Store,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import type { CartaMetodoPago, CartaMunicipio, CartaNegocio } from "@/lib/menu-publico.functions";
import {
  crearPedidoDomicilio,
  qrMetodoPagoUrl,
  subirComprobanteDomicilio,
  type MetodoPagoDomicilio,
} from "@/lib/domicilios-publico.functions";
import { ApiError } from "@/lib/api-client";
import { formatMoney } from "@/lib/format";
import { publicUrl } from "@/lib/storage";
import {
  guardarDatosCliente,
  guardarPedidoReciente,
  leerDatosCliente,
  lineasAItems,
  type Carrito,
} from "./carrito";
import { Stepper } from "./producto-pedido-sheet";

type Paso = "carrito" | "datos" | "pago";
const PASOS: Paso[] = ["carrito", "datos", "pago"];
const TITULOS: Record<Paso, string> = { carrito: "Tu pedido", datos: "Entrega", pago: "Pago" };

const inputStyle: React.CSSProperties = {
  background: "var(--menu-bg)",
  border: "1px solid var(--menu-border)",
  borderRadius: "var(--menu-radius)",
};

export default function CheckoutSheet({
  open,
  onOpenChange,
  idNegocio,
  negocio,
  municipios,
  metodos,
  carrito,
  themeStyle,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  idNegocio: string;
  negocio: CartaNegocio;
  municipios: CartaMunicipio[];
  metodos: CartaMetodoPago[];
  carrito: Carrito;
  themeStyle: React.CSSProperties;
}) {
  const navigate = useNavigate();
  const [paso, setPaso] = useState<Paso>("carrito");
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [direccion, setDireccion] = useState("");
  const [referencia, setReferencia] = useState("");
  const [idMunicipio, setIdMunicipio] = useState("");
  const [notas, setNotas] = useState("");
  const [metodo, setMetodo] = useState<MetodoPagoDomicilio | null>(null);
  const [pagaCon, setPagaCon] = useState("");
  const [idMetodoPago, setIdMetodoPago] = useState<string | null>(null);
  const [comprobante, setComprobante] = useState<File | null>(null);
  // Una llave por intento de envío: un doble toque o un reintento por red no duplica el pedido.
  const idemRef = useRef<string>(crypto.randomUUID());
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const d = leerDatosCliente();
    setNombre((v) => v || d.nombre || "");
    setTelefono((v) => v || d.telefono || "");
    setDireccion((v) => v || d.direccion || "");
    setReferencia((v) => v || d.referencia || "");
    setIdMunicipio(
      (v) =>
        v || (municipios.some((m) => m.id_municipio === d.id_municipio) ? d.id_municipio! : ""),
    );
  }, [open, municipios]);

  useEffect(() => {
    if (open && carrito.lineas.length === 0) setPaso("carrito");
  }, [open, carrito.lineas.length]);

  const domicilioOn = negocio.domicilios_activo === true;
  const recogerOn = negocio.recoger_activo === true;
  const tipo = domicilioOn && recogerOn ? carrito.tipo : domicilioOn ? "DOMICILIO" : "RECOGER";
  const esDomicilio = tipo === "DOMICILIO";
  const municipio = municipios.find((m) => m.id_municipio === idMunicipio) ?? null;
  const envio = esDomicilio ? (municipio?.costo_envio ?? 0) : 0;
  const total = carrito.subtotal + envio;
  const minimo = Number(negocio.pedido_minimo ?? 0);
  const faltaMinimo = Math.max(0, minimo - carrito.subtotal);

  // Método por defecto según el tipo de entrega; transferencia solo si hay métodos visibles.
  const metodosDisponibles: MetodoPagoDomicilio[] = useMemo(() => {
    const base: MetodoPagoDomicilio[] = esDomicilio ? ["EFECTIVO"] : ["EN_LOCAL"];
    return metodos.length > 0 ? [...base, "TRANSFERENCIA"] : base;
  }, [esDomicilio, metodos.length]);
  useEffect(() => {
    if (!metodo || !metodosDisponibles.includes(metodo)) setMetodo(metodosDisponibles[0]);
  }, [metodo, metodosDisponibles]);
  useEffect(() => {
    if (metodo === "TRANSFERENCIA" && !idMetodoPago && metodos[0]) setIdMetodoPago(metodos[0].id);
  }, [metodo, idMetodoPago, metodos]);

  const telOk = telefono.replace(/\D/g, "").length >= 7;
  const datosOk =
    nombre.trim().length >= 2 &&
    telOk &&
    (!esDomicilio || (direccion.trim().length >= 5 && !!municipio));
  const pagaConNum = Number(pagaCon.replace(/\D/g, ""));
  const pagaConOk = metodo !== "EFECTIVO" || pagaCon === "" || pagaConNum >= total;

  const crear = useMutation({
    mutationFn: async () => {
      const r = await crearPedidoDomicilio({
        idNegocio,
        tipo,
        cliente_nombre: nombre.trim(),
        cliente_telefono: telefono.trim(),
        direccion: esDomicilio ? direccion.trim() : null,
        referencia: esDomicilio ? referencia.trim() || null : null,
        id_municipio: esDomicilio ? idMunicipio : null,
        metodo_pago: metodo!,
        paga_con: metodo === "EFECTIVO" && pagaCon ? pagaConNum : null,
        id_metodo_pago: metodo === "TRANSFERENCIA" ? idMetodoPago : null,
        notas: notas.trim() || null,
        idempotency_key: idemRef.current,
        items: lineasAItems(carrito.lineas),
      });
      let comprobanteFallo = false;
      if (metodo === "TRANSFERENCIA" && comprobante) {
        try {
          await subirComprobanteDomicilio(r.token, comprobante);
        } catch {
          comprobanteFallo = true;
        }
      }
      return { ...r, comprobanteFallo };
    },
    onSuccess: (r) => {
      guardarDatosCliente({
        nombre: nombre.trim(),
        telefono: telefono.trim(),
        direccion: direccion.trim(),
        referencia: referencia.trim(),
        id_municipio: idMunicipio,
      });
      guardarPedidoReciente(idNegocio, { token: r.token, codigo: r.codigo, creado: Date.now() });
      carrito.vaciar();
      idemRef.current = crypto.randomUUID();
      onOpenChange(false);
      if (r.comprobanteFallo)
        toast.error(
          "El pedido se envió, pero el comprobante no subió. Puedes subirlo desde el seguimiento.",
        );
      void navigate({ to: "/pedido/$token", params: { token: r.token }, search: { nuevo: 1 } });
    },
    onError: (e) =>
      toast.error("No pudimos enviar tu pedido", {
        description: e instanceof ApiError || e instanceof Error ? e.message : undefined,
      }),
  });

  const idx = PASOS.indexOf(paso);
  const puedeSeguir =
    paso === "carrito"
      ? carrito.lineas.length > 0 && faltaMinimo === 0
      : paso === "datos"
        ? datosOk
        : !!metodo && pagaConOk && (metodo !== "TRANSFERENCIA" || !!idMetodoPago);

  function siguiente() {
    if (!puedeSeguir) return;
    if (paso === "pago") crear.mutate();
    else setPaso(PASOS[idx + 1]);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="mx-auto flex max-h-[94vh] w-full max-w-lg flex-col gap-0 border-0 p-0 [&>button.absolute]:hidden"
        style={{
          ...themeStyle,
          background: "var(--menu-surface)",
          color: "var(--menu-foreground)",
          fontFamily: "var(--menu-body-font)",
          borderTopLeftRadius: "calc(var(--menu-radius) + 0.75rem)",
          borderTopRightRadius: "calc(var(--menu-radius) + 0.75rem)",
        }}
      >
        <div
          className="mx-auto mt-2 h-1.5 w-10 rounded-full"
          style={{ background: "var(--menu-border)" }}
        />
        <header className="flex items-center gap-2 px-5 pb-3 pt-2">
          {idx > 0 ? (
            <button
              type="button"
              aria-label="Atrás"
              onClick={() => setPaso(PASOS[idx - 1])}
              className="-ml-2 p-2"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          ) : null}
          <div className="flex-1">
            <SheetTitle
              className="text-xl font-bold"
              style={{ fontFamily: "var(--menu-heading-font)", color: "inherit" }}
            >
              {TITULOS[paso]}
            </SheetTitle>
            <SheetDescription className="sr-only">Pedido en línea</SheetDescription>
            <div className="mt-2 flex gap-1.5">
              {PASOS.map((p, i) => (
                <span
                  key={p}
                  className="h-1 flex-1 rounded-full transition-colors"
                  style={{ background: i <= idx ? "var(--menu-primary)" : "var(--menu-border)" }}
                />
              ))}
            </div>
          </div>
          <button
            type="button"
            aria-label="Cerrar"
            onClick={() => onOpenChange(false)}
            className="-mr-2 p-2"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4">
          {paso === "carrito" && (
            <div className="space-y-3">
              {carrito.lineas.length === 0 ? (
                <p className="py-10 text-center text-sm" style={{ color: "var(--menu-muted)" }}>
                  Tu pedido está vacío. Agrega productos desde el menú.
                </p>
              ) : (
                carrito.lineas.map((l) => {
                  const detalle = [
                    ...l.variantes.map((v) => v.nombre),
                    ...l.extras.map((e) => `+ ${e.nombre}`),
                    ...l.exclusiones.map((x) => `sin ${x.nombre}`),
                    l.nota ? `“${l.nota}”` : "",
                  ].filter(Boolean);
                  return (
                    <div key={l.key} className="flex gap-3">
                      <div
                        className="h-16 w-16 shrink-0 overflow-hidden"
                        style={{
                          background: "var(--menu-surface-2)",
                          borderRadius: "var(--menu-radius)",
                        }}
                      >
                        {l.url_imagen && (
                          <img
                            src={publicUrl(l.url_imagen) ?? undefined}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold leading-tight">{l.nombre}</p>
                        {detalle.length > 0 && (
                          <p
                            className="mt-0.5 line-clamp-2 text-xs"
                            style={{ color: "var(--menu-muted)" }}
                          >
                            {detalle.join(" · ")}
                          </p>
                        )}
                        <div className="mt-2 flex items-center justify-between">
                          <Stepper
                            compacto
                            min={0}
                            valor={l.cantidad}
                            onChange={(n) => carrito.cambiarCantidad(l.key, n)}
                          />
                          <span className="text-sm font-semibold">
                            {formatMoney(l.precio_unitario * l.cantidad)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              {carrito.lineas.length > 0 && (
                <button
                  type="button"
                  onClick={carrito.vaciar}
                  className="flex items-center gap-1.5 text-xs"
                  style={{ color: "var(--menu-muted)" }}
                >
                  <Trash2 className="h-3.5 w-3.5" /> Vaciar pedido
                </button>
              )}
              {faltaMinimo > 0 && carrito.lineas.length > 0 && (
                <p
                  className="px-3 py-2 text-xs font-medium"
                  style={{
                    background: "color-mix(in oklab, var(--menu-accent) 18%, transparent)",
                    borderRadius: "var(--menu-radius)",
                  }}
                >
                  Te faltan {formatMoney(faltaMinimo)} para el pedido mínimo.
                </p>
              )}
            </div>
          )}

          {paso === "datos" && (
            <div className="space-y-4">
              {domicilioOn && recogerOn && (
                <div className="grid grid-cols-2 gap-2">
                  <Tarjeta
                    activa={tipo === "DOMICILIO"}
                    onClick={() => carrito.setTipo("DOMICILIO")}
                    icon={<Bike className="h-5 w-5" />}
                    titulo="A domicilio"
                    sub="Te lo llevamos"
                  />
                  <Tarjeta
                    activa={tipo === "RECOGER"}
                    onClick={() => carrito.setTipo("RECOGER")}
                    icon={<ShoppingBag className="h-5 w-5" />}
                    titulo="Para recoger"
                    sub="Pasas por él"
                  />
                </div>
              )}
              <Campo label="Nombre">
                <input
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value.slice(0, 60))}
                  autoComplete="name"
                  className="h-11 w-full px-3 text-sm outline-none"
                  style={inputStyle}
                />
              </Campo>
              <Campo label="Celular (WhatsApp)">
                <input
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value.slice(0, 20))}
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="300 123 4567"
                  className="h-11 w-full px-3 text-sm outline-none"
                  style={inputStyle}
                />
              </Campo>
              {esDomicilio ? (
                <>
                  <Campo label="Municipio">
                    <select
                      value={idMunicipio}
                      onChange={(e) => setIdMunicipio(e.target.value)}
                      className="h-11 w-full px-3 text-sm outline-none"
                      style={inputStyle}
                    >
                      <option value="">Selecciona tu municipio</option>
                      {municipios.map((m) => (
                        <option key={m.id_municipio} value={m.id_municipio}>
                          {m.nombre} · envío{" "}
                          {m.costo_envio === 0 ? "gratis" : formatMoney(m.costo_envio)}
                        </option>
                      ))}
                    </select>
                  </Campo>
                  <Campo label="Dirección">
                    <input
                      value={direccion}
                      onChange={(e) => setDireccion(e.target.value.slice(0, 200))}
                      autoComplete="street-address"
                      placeholder="Calle 10 # 5-20, barrio"
                      className="h-11 w-full px-3 text-sm outline-none"
                      style={inputStyle}
                    />
                  </Campo>
                  <Campo label="Referencia (opcional)">
                    <input
                      value={referencia}
                      onChange={(e) => setReferencia(e.target.value.slice(0, 200))}
                      placeholder="Apto, torre, portería…"
                      className="h-11 w-full px-3 text-sm outline-none"
                      style={inputStyle}
                    />
                  </Campo>
                </>
              ) : (
                <div
                  className="flex gap-3 p-3 text-sm"
                  style={{ ...inputStyle, background: "var(--menu-surface-2)" }}
                >
                  <Store className="mt-0.5 h-5 w-5 shrink-0" />
                  <div>
                    <p className="font-semibold">Recoges en {negocio.nombre_comercial}</p>
                    {negocio.direccion && (
                      <p style={{ color: "var(--menu-muted)" }}>{negocio.direccion}</p>
                    )}
                  </div>
                </div>
              )}
              <Campo label="Notas para el pedido (opcional)">
                <textarea
                  value={notas}
                  onChange={(e) => setNotas(e.target.value.slice(0, 300))}
                  rows={2}
                  className="w-full resize-none px-3 py-2 text-sm outline-none"
                  style={inputStyle}
                />
              </Campo>
            </div>
          )}

          {paso === "pago" && (
            <div className="space-y-4">
              <div className="space-y-2">
                {metodosDisponibles.map((m) => (
                  <Tarjeta
                    key={m}
                    fila
                    activa={metodo === m}
                    onClick={() => setMetodo(m)}
                    icon={
                      m === "TRANSFERENCIA" ? (
                        <Landmark className="h-5 w-5" />
                      ) : m === "EFECTIVO" ? (
                        <Banknote className="h-5 w-5" />
                      ) : (
                        <Store className="h-5 w-5" />
                      )
                    }
                    titulo={
                      m === "TRANSFERENCIA"
                        ? "Transferencia"
                        : m === "EFECTIVO"
                          ? "Efectivo contra entrega"
                          : "Pago en el local"
                    }
                    sub={
                      m === "TRANSFERENCIA"
                        ? "Paga ahora y adjunta el comprobante"
                        : m === "EFECTIVO"
                          ? "Pagas al recibir"
                          : "Pagas al recoger"
                    }
                  />
                ))}
              </div>

              {metodo === "EFECTIVO" && (
                <Campo label="¿Con cuánto pagas? (opcional, para llevar el cambio)">
                  <input
                    value={pagaCon ? formatMoney(pagaConNum) : ""}
                    onChange={(e) => setPagaCon(e.target.value.replace(/\D/g, "").slice(0, 9))}
                    inputMode="numeric"
                    placeholder={formatMoney(Math.ceil(total / 10000) * 10000)}
                    className="h-11 w-full px-3 text-sm outline-none"
                    style={inputStyle}
                  />
                  {!pagaConOk && (
                    <p className="mt-1 text-xs" style={{ color: "var(--menu-primary)" }}>
                      Debe ser mayor o igual al total.
                    </p>
                  )}
                </Campo>
              )}

              {metodo === "TRANSFERENCIA" && (
                <div className="space-y-3">
                  {metodos.length > 1 && (
                    <div className="flex flex-wrap gap-2">
                      {metodos.map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => setIdMetodoPago(m.id)}
                          className="rounded-full px-3 py-1.5 text-xs font-semibold"
                          style={{
                            border: "1px solid var(--menu-border)",
                            background:
                              idMetodoPago === m.id ? "var(--menu-primary)" : "transparent",
                            color:
                              idMetodoPago === m.id ? "var(--menu-primary-foreground)" : "inherit",
                          }}
                        >
                          {m.nombre}
                        </button>
                      ))}
                    </div>
                  )}
                  {metodos
                    .filter((m) => m.id === idMetodoPago)
                    .map((m) => (
                      <DatosTransferencia
                        key={m.id}
                        idNegocio={idNegocio}
                        metodo={m}
                        total={total}
                      />
                    ))}
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*,application/pdf"
                    className="hidden"
                    onChange={(e) => setComprobante(e.target.files?.[0] ?? null)}
                  />
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="flex w-full items-center gap-3 px-3 py-3 text-left text-sm"
                    style={{ ...inputStyle, borderStyle: comprobante ? "solid" : "dashed" }}
                  >
                    {comprobante ? (
                      <Check className="h-5 w-5" style={{ color: "var(--menu-primary)" }} />
                    ) : (
                      <Paperclip className="h-5 w-5" />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">
                        {comprobante ? "Comprobante listo" : "Adjuntar comprobante"}
                      </span>
                      <span
                        className="block truncate text-xs"
                        style={{ color: "var(--menu-muted)" }}
                      >
                        {comprobante
                          ? comprobante.name
                          : "También puedes enviarlo después desde el seguimiento"}
                      </span>
                    </span>
                  </button>
                </div>
              )}

              <Totales
                subtotal={carrito.subtotal}
                envio={envio}
                esDomicilio={esDomicilio}
                municipio={municipio?.nombre ?? null}
                total={total}
              />
            </div>
          )}
        </div>

        <footer
          className="px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3"
          style={{ borderTop: "1px solid var(--menu-border)" }}
        >
          <button
            type="button"
            onClick={siguiente}
            disabled={!puedeSeguir || crear.isPending}
            className="flex min-h-[52px] w-full items-center justify-between gap-2 px-5 py-3.5 text-base font-semibold transition-opacity disabled:opacity-50"
            style={{
              background: "var(--menu-primary)",
              color: "var(--menu-primary-foreground)",
              borderRadius: "var(--menu-radius)",
              boxShadow: "var(--menu-shadow, none)",
            }}
          >
            <span className="flex items-center gap-2">
              {crear.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {paso === "pago" ? "Enviar pedido" : "Continuar"}
            </span>
            <span>{formatMoney(paso === "carrito" ? carrito.subtotal : total)}</span>
          </button>
        </footer>
      </SheetContent>
    </Sheet>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-semibold" style={{ color: "var(--menu-muted)" }}>
        {label}
      </span>
      {children}
    </label>
  );
}

function Tarjeta({
  activa,
  onClick,
  icon,
  titulo,
  sub,
  fila,
}: {
  activa: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  titulo: string;
  sub: string;
  fila?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activa}
      className={`flex w-full gap-3 p-3 text-left transition-colors ${fila ? "items-center" : "flex-col"}`}
      style={{
        border: `1.5px solid ${activa ? "var(--menu-primary)" : "var(--menu-border)"}`,
        background: activa
          ? "color-mix(in oklab, var(--menu-primary) 9%, transparent)"
          : "transparent",
        borderRadius: "var(--menu-radius)",
      }}
    >
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
        style={{
          background: activa ? "var(--menu-primary)" : "var(--menu-surface-2)",
          color: activa ? "var(--menu-primary-foreground)" : "inherit",
        }}
      >
        {icon}
      </span>
      <span>
        <span className="block text-sm font-semibold">{titulo}</span>
        <span className="block text-xs" style={{ color: "var(--menu-muted)" }}>
          {sub}
        </span>
      </span>
    </button>
  );
}

function DatosTransferencia({
  idNegocio,
  metodo,
  total,
}: {
  idNegocio: string;
  metodo: CartaMetodoPago;
  total: number;
}) {
  const [copiado, setCopiado] = useState(false);
  return (
    <div className="space-y-3 p-4" style={{ ...inputStyle, background: "var(--menu-surface-2)" }}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold">{metodo.nombre}</p>
          {metodo.titular && (
            <p className="text-xs" style={{ color: "var(--menu-muted)" }}>
              {metodo.titular}
            </p>
          )}
          {metodo.datos_cuenta && (
            <p className="mt-1 break-all font-mono text-sm">{metodo.datos_cuenta}</p>
          )}
        </div>
        {metodo.datos_cuenta && (
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard?.writeText(metodo.datos_cuenta!);
              setCopiado(true);
              setTimeout(() => setCopiado(false), 1500);
            }}
            className="flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold"
            style={{ background: "var(--menu-surface)", border: "1px solid var(--menu-border)" }}
          >
            {copiado ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copiado ? "Copiado" : "Copiar"}
          </button>
        )}
      </div>
      {metodo.tiene_qr && (
        <img
          src={qrMetodoPagoUrl(idNegocio, metodo.id)}
          alt={`QR ${metodo.nombre}`}
          className="mx-auto aspect-square w-44 rounded-lg bg-white object-contain p-2"
          loading="lazy"
        />
      )}
      <p className="text-center text-xs" style={{ color: "var(--menu-muted)" }}>
        Transfiere <strong style={{ color: "var(--menu-foreground)" }}>{formatMoney(total)}</strong>{" "}
        y adjunta el comprobante.
      </p>
    </div>
  );
}

export function Totales({
  subtotal,
  envio,
  esDomicilio,
  municipio,
  total,
}: {
  subtotal: number;
  envio: number;
  esDomicilio: boolean;
  municipio: string | null;
  total: number;
}) {
  return (
    <dl className="space-y-1.5 pt-1 text-sm">
      <div className="flex justify-between">
        <dt style={{ color: "var(--menu-muted)" }}>Productos</dt>
        <dd>{formatMoney(subtotal)}</dd>
      </div>
      {esDomicilio && (
        <div className="flex justify-between">
          <dt style={{ color: "var(--menu-muted)" }}>Envío{municipio ? ` · ${municipio}` : ""}</dt>
          <dd>{envio === 0 ? "Gratis" : formatMoney(envio)}</dd>
        </div>
      )}
      <div
        className="flex justify-between pt-1.5 text-base font-bold"
        style={{ borderTop: "1px dashed var(--menu-border)" }}
      >
        <dt>Total</dt>
        <dd>{formatMoney(total)}</dd>
      </div>
    </dl>
  );
}
