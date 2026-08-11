import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ESTADOS_RESERVA,
  ESTADO_LABEL,
  MEDIO_ABONO_EFECTIVO,
  reservaCrearSchema,
  type EstadoReserva,
} from "@/lib/reservas.schemas";
import { fechaLocalISO, formatMoney } from "@/lib/format";
import { actualizarReserva, crearReserva, type Reserva } from "@/lib/reservas.functions";
import { listarMetodosPago } from "@/lib/metodos-pago.functions";
import { crearDecoracion, listarDecoraciones } from "@/lib/decoraciones.functions";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  reserva?: Reserva | null;
}

const today = () => fechaLocalISO();

/** Valor centinela del selector: abono recibido sin cuenta QR (efectivo u otro). */
const CUENTA_EFECTIVO = "__efectivo__";

/** Valor centinela del selector de decoración: la reserva no lleva ninguna. */
const SIN_DECORACION = "__ninguna__";

type FormState = {
  customer_name: string;
  customer_phone: string;
  fecha_reserva: string;
  hora_reserva: string;
  cantidad_personas: string;
  // El motivo ya no se escribe a mano: cuando la reserva lleva decoración, guarda el
  // nombre del tipo de decoración (para reportes); si no, queda vacío.
  tipo_reserva: string;
  con_decoracion: boolean;
  estado: EstadoReserva;
  monto_abonado: string;
  id_metodo_pago_qr: string;
  id_decoracion: string;
  costo_decoracion: string;
  notas: string;
};

const empty = (): FormState => ({
  customer_name: "",
  customer_phone: "",
  fecha_reserva: today(),
  hora_reserva: "",
  cantidad_personas: "2",
  tipo_reserva: "",
  con_decoracion: false,
  estado: "intencion",
  monto_abonado: "0",
  id_metodo_pago_qr: "",
  id_decoracion: "",
  costo_decoracion: "0",
  notas: "",
});

export function ReservaFormSheet({ open, onOpenChange, reserva }: Props) {
  const qc = useQueryClient();
  const editing = !!reserva;

  const [form, setForm] = useState<FormState>(empty());
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    if (reserva) {
      setForm({
        customer_name: reserva.customer_name,
        customer_phone: reserva.customer_phone ?? "",
        fecha_reserva: reserva.fecha_reserva,
        hora_reserva: reserva.hora_reserva,
        cantidad_personas: String(reserva.cantidad_personas),
        tipo_reserva: reserva.tipo_reserva ?? "",
        con_decoracion: !!reserva.id_decoracion,
        estado: reserva.estado,
        monto_abonado: String(reserva.monto_abonado),
        id_metodo_pago_qr: reserva.id_metodo_pago_qr ?? "",
        id_decoracion: reserva.id_decoracion ?? "",
        costo_decoracion: String(reserva.costo_decoracion ?? 0),
        notas: reserva.notas ?? "",
      });
    } else {
      setForm(empty());
    }
    setErrors({});
  }, [open, reserva]);

  const mut = useMutation({
    mutationFn: async () => {
      const monto = Number(form.monto_abonado) || 0;
      const cuenta = form.id_metodo_pago_qr;
      // La decoración solo se envía si el tipo de reserva es "con decoración" y se
      // eligió una: si el usuario cambia a "sin decoración", la fila desaparece de la
      // UI y guardar una decoración invisible dejaría un cobro sorpresa en la cuenta.
      const conDeco = form.con_decoracion && !!form.id_decoracion;
      const parsed = reservaCrearSchema.safeParse({
        customer_name: form.customer_name,
        customer_phone: form.customer_phone || null,
        fecha_reserva: form.fecha_reserva,
        hora_reserva: form.hora_reserva,
        cantidad_personas: Number(form.cantidad_personas) || 0,
        // El motivo es el nombre de la decoración; sin decoración no hay motivo.
        tipo_reserva: conDeco ? form.tipo_reserva || null : null,
        estado: form.estado,
        monto_abonado: monto,
        // NULL = efectivo/otro: el abono no siempre entra por una cuenta QR.
        id_metodo_pago_qr: monto > 0 && cuenta && cuenta !== CUENTA_EFECTIVO ? cuenta : null,
        id_decoracion: conDeco ? form.id_decoracion : null,
        costo_decoracion: conDeco ? Number(form.costo_decoracion) || 0 : 0,
        notas: form.notas || null,
      });
      if (!parsed.success) {
        const e: Record<string, string> = {};
        for (const issue of parsed.error.issues) {
          e[String(issue.path[0])] = issue.message;
        }
        setErrors(e);
        // El detalle va en el toast además de bajo el campo: si el que falla está
        // fuera de la vista (el sheet hace scroll) parecía que el botón no hacía nada.
        throw new Error(Object.values(e).join(" · ") || "Revisa los campos");
      }
      setErrors({});
      if (editing && reserva) {
        await actualizarReserva(reserva.id_reserva, parsed.data);
      } else {
        await crearReserva(parsed.data);
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Reserva actualizada" : "Reserva creada");
      qc.invalidateQueries({ queryKey: ["reservas"] });
      onOpenChange(false);
    },
    onError: (e) => {
      const msg = e instanceof Error ? e.message : "Error";
      toast.error(msg);
    },
  });

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((s) => ({ ...s, [k]: v }));

  /**
   * Escribir un monto sube el estado a "Abonado" solo. Antes eran dos campos
   * independientes: se registraba el abono con estado "Intención" y la reserva
   * nunca aparecía en el checkout para descontarla. Se revierte si se borra el
   * monto, y el selector de estado sigue visible para corregirlo a mano.
   */
  const setMonto = (raw: string) =>
    setForm((s) => {
      const monto = Number(raw) || 0;
      if (monto > 0 && s.estado === "intencion") return { ...s, monto_abonado: raw, estado: "abonado" };
      if (monto <= 0 && s.estado === "abonado") return { ...s, monto_abonado: raw, estado: "intencion" };
      return { ...s, monto_abonado: raw };
    });

  const cuentasQ = useQuery({
    queryKey: ["metodosPago"],
    queryFn: () => listarMetodosPago(),
    enabled: open,
  });
  const cuentas = cuentasQ.data ?? [];
  const montoNum = Number(form.monto_abonado) || 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{editing ? "Editar reserva" : "Nueva reserva"}</SheetTitle>
          <SheetDescription>
            {editing
              ? `Código: ${reserva?.codigo_reserva}`
              : "El código se genera automáticamente al guardar."}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 py-4">
          <div>
            <Label htmlFor="nombre">Nombre del cliente *</Label>
            <Input
              id="nombre"
              value={form.customer_name}
              onChange={(e) => set("customer_name", e.target.value)}
              maxLength={100}
            />
            {errors.customer_name && (
              <p className="text-xs text-destructive mt-1">{errors.customer_name}</p>
            )}
          </div>
          <div>
            <Label htmlFor="tel">Teléfono (opcional)</Label>
            <Input
              id="tel"
              value={form.customer_phone}
              onChange={(e) => set("customer_phone", e.target.value)}
              placeholder="Ej: 3001234567"
              maxLength={30}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Sin número no se podrá enviar el mensaje de WhatsApp.
            </p>
          </div>
          <div>
            <Label htmlFor="notas">Notas (opcional)</Label>
            <Textarea
              id="notas"
              value={form.notas}
              onChange={(e) => set("notas", e.target.value)}
              placeholder="Ej: decoración especial, forma de la mesa, instrucciones…"
              maxLength={500}
              rows={3}
            />
            {errors.notas && <p className="text-xs text-destructive mt-1">{errors.notas}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="fecha">Fecha *</Label>
              <Input
                id="fecha"
                type="date"
                value={form.fecha_reserva}
                onChange={(e) => set("fecha_reserva", e.target.value)}
              />
              {errors.fecha_reserva && (
                <p className="text-xs text-destructive mt-1">{errors.fecha_reserva}</p>
              )}
            </div>
            <div>
              <Label htmlFor="hora">Hora *</Label>
              <Select value={form.hora_reserva} onValueChange={(v) => set("hora_reserva", v)}>
                <SelectTrigger id="hora">
                  <SelectValue placeholder="Selecciona hora" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {Array.from({ length: 24 }).map((_, h) => {
                    const value = `${String(h).padStart(2, "0")}:00`;
                    const label = (() => {
                      const period = h < 12 ? "am" : "pm";
                      const h12 = ((h + 11) % 12) + 1;
                      return `${value} (${h12} ${period})`;
                    })();
                    return (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              {errors.hora_reserva && (
                <p className="text-xs text-destructive mt-1">{errors.hora_reserva}</p>
              )}
            </div>
          </div>
          <div>
            <Label htmlFor="personas">N° de personas *</Label>
            <Input
              id="personas"
              type="number"
              min={1}
              value={form.cantidad_personas}
              onChange={(e) => set("cantidad_personas", e.target.value)}
            />
            {errors.cantidad_personas && (
              <p className="text-xs text-destructive mt-1">{errors.cantidad_personas}</p>
            )}
          </div>
          <div>
            <Label htmlFor="tipo-reserva">Tipo de reserva</Label>
            <Select
              value={form.con_decoracion ? "con" : "sin"}
              onValueChange={(v) => {
                const con = v === "con";
                setForm((s) => ({
                  ...s,
                  con_decoracion: con,
                  // Al pasar a "sin decoración" se limpia todo lo de la decoración
                  // para no dejar un cobro fantasma en la cuenta.
                  id_decoracion: con ? s.id_decoracion : "",
                  costo_decoracion: con ? s.costo_decoracion : "0",
                  tipo_reserva: con ? s.tipo_reserva : "",
                }));
              }}
            >
              <SelectTrigger id="tipo-reserva">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sin">Sin decoración</SelectItem>
                <SelectItem value="con">Con decoración</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {form.con_decoracion && (
            <DecoracionRow
              open={open}
              idDecoracion={form.id_decoracion}
              costo={form.costo_decoracion}
              onSelect={(id, costoCatalogo, nombre) =>
                setForm((s) => ({
                  ...s,
                  id_decoracion: id,
                  // Al elegir se copia el precio del catálogo, pero queda editable:
                  // el costo guardado es un snapshot de esta reserva.
                  costo_decoracion: id ? String(costoCatalogo) : "0",
                  // El nombre de la decoración pasa a ser el motivo de la reserva.
                  tipo_reserva: id ? nombre : "",
                }))
              }
              onCostoChange={(v) => set("costo_decoracion", v)}
              error={errors.id_decoracion}
            />
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="estado">Estado</Label>
              <Select value={form.estado} onValueChange={(v) => set("estado", v as EstadoReserva)}>
                <SelectTrigger id="estado">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ESTADOS_RESERVA.map((s) => (
                    <SelectItem key={s} value={s}>
                      {ESTADO_LABEL[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.estado && (
                <p className="text-xs text-destructive mt-1">{errors.estado}</p>
              )}
            </div>
            <div>
              <Label htmlFor="monto">Monto abonado</Label>
              <Input
                id="monto"
                inputMode="numeric"
                value={form.monto_abonado}
                onChange={(e) => setMonto(e.target.value.replace(/[^\d]/g, ""))}
                placeholder="0"
              />
              {errors.monto_abonado && (
                <p className="text-xs text-destructive mt-1">{errors.monto_abonado}</p>
              )}
            </div>
            {montoNum > 0 && (
              <div>
                <Label htmlFor="cuenta">Dónde se recibió el abono</Label>
                {/* "Efectivo / otro" siempre disponible: antes, un negocio sin
                    cuentas QR cargadas no tenía ningún control aquí y el
                    formulario no dejaba guardar nunca. */}
                <Select
                  value={form.id_metodo_pago_qr || CUENTA_EFECTIVO}
                  onValueChange={(v) => set("id_metodo_pago_qr", v)}
                >
                  <SelectTrigger id="cuenta">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={CUENTA_EFECTIVO}>{MEDIO_ABONO_EFECTIVO}</SelectItem>
                    {cuentas.map((c) => (
                      <SelectItem key={c.id_qr} value={c.id_qr}>
                        {c.nombre}
                        {c.titular ? ` · ${c.titular}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {cuentas.length === 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    ¿Recibiste el abono por transferencia?{" "}
                    <Link
                      to="/configuracion/metodos-pago"
                      className="text-primary underline"
                      onClick={() => onOpenChange(false)}
                    >
                      Configura tus cuentas
                    </Link>
                  </p>
                )}
                {errors.id_metodo_pago_qr && (
                  <p className="text-xs text-destructive mt-1">{errors.id_metodo_pago_qr}</p>
                )}
              </div>
            )}
          </div>
        </div>

        <SheetFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending}>
            {mut.isPending ? "Guardando..." : editing ? "Guardar cambios" : "Crear reserva"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

/**
 * Selector de tipo de decoración + creación inline. El "+ Crear tipo" evita mandar
 * al usuario a otra pantalla en mitad de la reserva (que es lo que hace el enlace de
 * métodos de pago) — aquí el catálogo se llena mientras se atiende al cliente.
 *
 * El costo queda editable después de elegir: lo que se guarda en la reserva es un
 * snapshot, no una referencia viva al precio del catálogo.
 */
function DecoracionRow({
  open,
  idDecoracion,
  costo,
  onSelect,
  onCostoChange,
  error,
}: {
  open: boolean;
  idDecoracion: string;
  costo: string;
  onSelect: (idDecoracion: string, costoCatalogo: number, nombre: string) => void;
  onCostoChange: (v: string) => void;
  error?: string;
}) {
  const qc = useQueryClient();
  const [creando, setCreando] = useState(false);
  const [nombreNuevo, setNombreNuevo] = useState("");
  const [costoNuevo, setCostoNuevo] = useState("0");

  const decosQ = useQuery({
    queryKey: ["decoraciones"],
    queryFn: () => listarDecoraciones(),
    enabled: open,
  });
  const decoraciones = decosQ.data ?? [];

  const crearMut = useMutation({
    mutationFn: () =>
      crearDecoracion({ nombre: nombreNuevo.trim(), costo: Number(costoNuevo) || 0 }),
    onSuccess: (nueva) => {
      toast.success(`Decoración "${nueva.nombre}" creada`);
      qc.invalidateQueries({ queryKey: ["decoraciones"] });
      onSelect(nueva.id_decoracion, nueva.costo, nueva.nombre);
      setCreando(false);
      setNombreNuevo("");
      setCostoNuevo("0");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "No se pudo crear"),
  });

  return (
    <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
      <div>
        <Label htmlFor="decoracion">Decoración</Label>
        <div className="flex gap-2">
          <Select
            value={idDecoracion || SIN_DECORACION}
            onValueChange={(v) => {
              if (v === SIN_DECORACION) return onSelect("", 0, "");
              const d = decoraciones.find((x) => x.id_decoracion === v);
              onSelect(v, d?.costo ?? 0, d?.nombre ?? "");
            }}
          >
            <SelectTrigger id="decoracion" className="flex-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={SIN_DECORACION}>Sin elegir</SelectItem>
              {decoraciones.map((d) => (
                <SelectItem key={d.id_decoracion} value={d.id_decoracion}>
                  {d.nombre} · {formatMoney(d.costo)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Crear tipo de decoración"
            onClick={() => setCreando((v) => !v)}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        {error && <p className="text-xs text-destructive mt-1">{error}</p>}
        {decoraciones.length === 0 && !creando && (
          <p className="text-xs text-muted-foreground mt-1">
            Aún no hay tipos de decoración. Crea uno con el botón +.
          </p>
        )}
      </div>

      {creando && (
        <div className="space-y-2 rounded-md border bg-background p-3">
          <div>
            <Label htmlFor="deco-nombre" className="text-xs">
              Nombre del tipo
            </Label>
            <Input
              id="deco-nombre"
              value={nombreNuevo}
              onChange={(e) => setNombreNuevo(e.target.value)}
              placeholder="Ej: Globos y letrero"
              maxLength={60}
              autoFocus
            />
          </div>
          <div>
            <Label htmlFor="deco-costo" className="text-xs">
              Costo
            </Label>
            <Input
              id="deco-costo"
              inputMode="numeric"
              value={costoNuevo}
              onChange={(e) => setCostoNuevo(e.target.value.replace(/[^\d]/g, ""))}
              placeholder="0"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setCreando(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={nombreNuevo.trim().length < 2 || crearMut.isPending}
              onClick={() => crearMut.mutate()}
            >
              {crearMut.isPending ? "Creando..." : "Crear tipo"}
            </Button>
          </div>
        </div>
      )}

      {idDecoracion && (
        <div>
          <Label htmlFor="deco-costo-reserva">Costo a cobrar</Label>
          <Input
            id="deco-costo-reserva"
            inputMode="numeric"
            value={costo}
            onChange={(e) => onCostoChange(e.target.value.replace(/[^\d]/g, ""))}
          />
          <p className="text-xs text-muted-foreground mt-1">
            Se carga a la cuenta cuando se siente al cliente en una mesa.
          </p>
        </div>
      )}
    </div>
  );
}
