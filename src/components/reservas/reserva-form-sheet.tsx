import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
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
  reservaCrearSchema,
  type EstadoReserva,
} from "@/lib/reservas.schemas";
import {
  actualizarReserva,
  crearReserva,
  type Reserva,
} from "@/lib/reservas.functions";
import { listarMetodosPagoQr } from "@/lib/metodos-pago.functions";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  reserva?: Reserva | null;
}

const today = () => new Date().toISOString().slice(0, 10);

type FormState = {
  customer_name: string;
  customer_phone: string;
  fecha_reserva: string;
  hora_reserva: string;
  cantidad_personas: string;
  tipo_reserva: string;
  estado: EstadoReserva;
  monto_abonado: string;
  id_metodo_pago_qr: string;
};

const empty = (): FormState => ({
  customer_name: "",
  customer_phone: "",
  fecha_reserva: today(),
  hora_reserva: "",
  cantidad_personas: "2",
  tipo_reserva: "",
  estado: "intencion",
  monto_abonado: "0",
  id_metodo_pago_qr: "",
});

const TIPO_SUGERENCIAS = ["Cumpleaños", "Aniversario", "Grado", "Cena", "Reunión"];

export function ReservaFormSheet({ open, onOpenChange, reserva }: Props) {
  const qc = useQueryClient();
  const crear = useServerFn(crearReserva);
  const actualizar = useServerFn(actualizarReserva);
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
        estado: reserva.estado,
        monto_abonado: String(reserva.monto_abonado),
        id_metodo_pago_qr: reserva.id_metodo_pago_qr ?? "",
      });
    } else {
      setForm(empty());
    }
    setErrors({});
  }, [open, reserva]);

  const mut = useMutation({
    mutationFn: async () => {
      const monto = Number(form.monto_abonado) || 0;
      const parsed = reservaCrearSchema.safeParse({
        customer_name: form.customer_name,
        customer_phone: form.customer_phone || null,
        fecha_reserva: form.fecha_reserva,
        hora_reserva: form.hora_reserva,
        cantidad_personas: Number(form.cantidad_personas) || 0,
        tipo_reserva: form.tipo_reserva || null,
        estado: form.estado,
        monto_abonado: monto,
        id_metodo_pago_qr: monto > 0 ? form.id_metodo_pago_qr || null : null,
      });
      if (!parsed.success) {
        const e: Record<string, string> = {};
        for (const issue of parsed.error.issues) {
          e[String(issue.path[0])] = issue.message;
        }
        setErrors(e);
        throw new Error("Revisa los campos");
      }
      setErrors({});
      if (editing && reserva) {
        await actualizar({ data: { id_reserva: reserva.id_reserva, ...parsed.data } });
      } else {
        await crear({ data: parsed.data });
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

  const listarQr = useServerFn(listarMetodosPagoQr);
  const cuentasQ = useQuery({
    queryKey: ["metodosPagoQr"],
    queryFn: () => listarQr(),
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
            <Label htmlFor="tel">Teléfono</Label>
            <Input
              id="tel"
              value={form.customer_phone}
              onChange={(e) => set("customer_phone", e.target.value)}
              placeholder="Ej: 3001234567"
              maxLength={30}
            />
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
              <Select
                value={form.hora_reserva}
                onValueChange={(v) => set("hora_reserva", v)}
              >
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
          </div>
          <div>
            <Label htmlFor="tipo">Tipo / motivo</Label>
            <Input
              id="tipo"
              value={form.tipo_reserva}
              onChange={(e) => set("tipo_reserva", e.target.value)}
              placeholder="Cumpleaños, Aniversario, Grado..."
              maxLength={50}
              list="tipo-suggestions"
            />
            <datalist id="tipo-suggestions">
              {TIPO_SUGERENCIAS.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="estado">Estado</Label>
              <Select
                value={form.estado}
                onValueChange={(v) => set("estado", v as EstadoReserva)}
              >
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
            </div>
            <div>
              <Label htmlFor="monto">Monto abonado</Label>
              <Input
                id="monto"
                inputMode="numeric"
                value={form.monto_abonado}
                onChange={(e) =>
                  set("monto_abonado", e.target.value.replace(/[^\d]/g, ""))
                }
                placeholder="0"
              />
              {errors.monto_abonado && (
                <p className="text-xs text-destructive mt-1">{errors.monto_abonado}</p>
              )}
          </div>
          {montoNum > 0 && (
            <div>
              <Label htmlFor="cuenta">Cuenta donde se recibió el abono *</Label>
              {cuentas.length === 0 ? (
                <p className="text-xs text-muted-foreground mt-1">
                  No hay cuentas configuradas.{" "}
                  <Link
                    to="/configuracion/metodos-pago"
                    className="text-primary underline"
                    onClick={() => onOpenChange(false)}
                  >
                    Configurar métodos de pago
                  </Link>
                </p>
              ) : (
                <Select
                  value={form.id_metodo_pago_qr}
                  onValueChange={(v) => set("id_metodo_pago_qr", v)}
                >
                  <SelectTrigger id="cuenta">
                    <SelectValue placeholder="Selecciona la cuenta" />
                  </SelectTrigger>
                  <SelectContent>
                    {cuentas.map((c) => {
                      const label =
                        c.plataforma === "Otra"
                          ? c.etiqueta || "Otra"
                          : c.plataforma;
                      return (
                        <SelectItem key={c.id_qr} value={c.id_qr}>
                          {label}
                          {c.titular ? ` · ${c.titular}` : ""}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              )}
              {errors.id_metodo_pago_qr && (
                <p className="text-xs text-destructive mt-1">
                  {errors.id_metodo_pago_qr}
                </p>
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
            {mut.isPending
              ? "Guardando..."
              : editing
                ? "Guardar cambios"
                : "Crear reserva"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
