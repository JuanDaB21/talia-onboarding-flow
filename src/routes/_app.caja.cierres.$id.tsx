import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { RoleGate } from "@/components/admin/role-gate";
import { ImprimirCierreButton } from "@/components/caja/imprimir-cierre-button";
import { getCierre } from "@/lib/caja.functions";
import { formatMoney } from "@/lib/format";

export const Route = createFileRoute("/_app/caja/cierres/$id")({
  head: () => ({ meta: [{ title: "Reporte de cierre — Talia" }] }),
  component: () => (
    <RoleGate roles={["ADMIN", "SUPERADMIN", "CAJERO"]}>
      <ReportePage />
    </RoleGate>
  ),
});

function ReportePage() {
  const { id } = Route.useParams();
  const { data, isLoading, error } = useQuery({
    queryKey: ["cierre", id],
    queryFn: () => getCierre(id),
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Cargando…</p>;
  if (error || !data)
    return (
      <p className="text-sm text-destructive">
        {error instanceof Error ? error.message : "Cierre no encontrado"}
      </p>
    );

  // Cierres desde backend 0044 incluyen la propina en el cuadre y exponen recibido/esperado.
  // Para históricos (propina_en_cuadre ausente) se hace fallback a las ventas (sin propina).
  const nuevo = data.propina_en_cuadre === true;
  const recEfe = data.recibido_efectivo ?? data.efectivo_sistema;
  const recTra = data.recibido_transferencia ?? data.transferencia_sistema;
  const recDat = data.recibido_datafono ?? data.datafono_sistema;
  const propEfe = recEfe - data.efectivo_sistema;
  const propTra = recTra - data.transferencia_sistema;
  const propDat = recDat - data.datafono_sistema;
  const esperadoEfe = data.efectivo_esperado ?? data.base_inicial + data.efectivo_sistema;
  const ingresos =
    data.total_ingresos ??
    data.ajustes.filter((a) => a.signo === "POSITIVO").reduce((s, a) => s + a.monto, 0);
  const egresos =
    data.total_egresos ??
    data.ajustes.filter((a) => a.signo === "NEGATIVO").reduce((s, a) => s + a.monto, 0);
  const total = recEfe + recTra + recDat;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center justify-between print:hidden">
        <Button asChild variant="ghost" size="sm">
          <Link to="/caja">
            <ChevronLeft className="mr-1 h-4 w-4" /> Volver
          </Link>
        </Button>
        <ImprimirCierreButton idCaja={id} size="sm" />
      </div>

      <div className="rounded-lg border bg-card p-6 print:border-0 print:p-0">
        <div className="text-center">
          <h1 className="text-xl font-bold">{data.negocio_nombre}</h1>
          <p className="text-sm text-muted-foreground">Reporte de cierre de caja</p>
          <p className="text-sm">Fecha: {data.fecha}</p>
          <p className="text-xs text-muted-foreground">
            Apertura: {new Date(data.abierta_at).toLocaleString()}
            {data.abierta_por_nombre && ` (${data.abierta_por_nombre})`}
            {data.cerrada_at && ` · Cierre: ${new Date(data.cerrada_at).toLocaleString()}`}
            {data.cerrada_por_nombre && ` (${data.cerrada_por_nombre})`}
          </p>
        </div>

        <Separator className="my-4" />

        <Section title="Conciliación">
          <Row label="Base inicial" value={formatMoney(data.base_inicial)} />
          <Separator className="my-2" />
          {/* Efectivo: ventas + propina = recibido, + ingresos − egresos = esperado, vs contado */}
          <Row label="Efectivo cobrado (ventas)" value={formatMoney(data.efectivo_sistema)} />
          {nuevo && propEfe > 0 && (
            <Row label="Propina en efectivo" value={formatMoney(propEfe)} />
          )}
          {nuevo && (
            <Row label="Efectivo recibido" value={formatMoney(recEfe)} />
          )}
          {nuevo && ingresos > 0 && <Row label="Ingresos (ajustes +)" value={`+${formatMoney(ingresos)}`} />}
          {nuevo && egresos > 0 && <Row label="Egresos (ajustes −)" value={`−${formatMoney(egresos)}`} />}
          <Row label="Efectivo esperado" value={formatMoney(esperadoEfe)} bold />
          <Row label="Efectivo contado" value={formatMoney(data.efectivo_fisico)} />
          <Row
            label="Diferencia efectivo"
            value={formatMoney(data.diferencia_efectivo)}
            highlight={data.diferencia_efectivo !== 0}
          />
          <Separator className="my-2" />
          {/* Datáfono */}
          <Row label="Datáfono (ventas)" value={formatMoney(data.datafono_sistema)} />
          {nuevo && propDat > 0 && <Row label="Propina en datáfono" value={formatMoney(propDat)} />}
          {nuevo && recDat !== data.datafono_sistema && (
            <Row label="Datáfono recibido" value={formatMoney(recDat)} bold />
          )}
          <Row label="Datáfono (cierre de lote)" value={formatMoney(data.datafono_fisico)} />
          <Row
            label="Diferencia datáfono"
            value={formatMoney(data.diferencia_datafono)}
            highlight={data.diferencia_datafono !== 0}
          />
          <Separator className="my-2" />
          {/* Transferencia (no se cuadra contra físico; se verifica pago a pago) */}
          <Row label="Transferencias (ventas)" value={formatMoney(data.transferencia_sistema)} />
          {nuevo && propTra > 0 && (
            <Row label="Propina en transferencia" value={formatMoney(propTra)} />
          )}
          {nuevo && (
            <Row label="Transferencias recibidas" value={formatMoney(recTra)} />
          )}
          <Separator className="my-2" />
          <Row
            label={nuevo ? "TOTAL RECIBIDO DEL CIERRE" : "TOTAL VENTAS DEL CIERRE"}
            value={formatMoney(total)}
            bold
          />
        </Section>

        <Separator className="my-4" />

        <Section title="Propinas">
          <Row label="Propinas cobradas" value={formatMoney(data.propinas_total)} bold />
          <Row label="En efectivo" value={formatMoney(data.propinas_efectivo)} />
          <Row label="En transferencia" value={formatMoney(data.propinas_transferencia)} />
          {data.propinas_datafono > 0 && (
            <Row label="En datáfono" value={formatMoney(data.propinas_datafono)} />
          )}
          <p className="text-xs text-muted-foreground">
            {nuevo
              ? "Ya incluidas en el total recibido de cada método (arriba)."
              : "No están incluidas en el total de ventas ni en el cuadre."}
          </p>
        </Section>

        {data.ajustes.length > 0 && (
          <>
            <Separator className="my-4" />
            <Section title="Ajustes adicionales">
              <Row label="Total ingresos" value={`+${formatMoney(ingresos)}`} />
              <Row label="Total egresos" value={`−${formatMoney(egresos)}`} />
              <Row
                label="Neto"
                value={`${data.total_ajustes >= 0 ? "+" : ""}${formatMoney(data.total_ajustes)}`}
                bold
              />
              <Separator className="my-2" />
              <ul className="space-y-1">
                {data.ajustes.map((a) => (
                  <li key={a.id_ajuste} className="flex items-center justify-between text-sm">
                    <span>
                      {a.nombre}{" "}
                      <span className="text-xs text-muted-foreground">
                        ({a.signo === "POSITIVO" ? "+" : "−"})
                      </span>
                      {a.nota && (
                        <span className="ml-2 text-xs text-muted-foreground">— {a.nota}</span>
                      )}
                    </span>
                    <span className="font-medium">
                      {a.signo === "POSITIVO" ? "+" : "−"}
                      {formatMoney(a.monto)}
                    </span>
                  </li>
                ))}
              </ul>
            </Section>
          </>
        )}

        {data.nota_cuadre && (
          <>
            <Separator className="my-4" />
            <Section title="Nota de cuadre">
              <p className="rounded-md border bg-muted/40 p-3 text-sm">{data.nota_cuadre}</p>
            </Section>
          </>
        )}

        {data.productos_vendidos.length > 0 && (
          <>
            <Separator className="my-4" />
            <Section title="Productos vendidos">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="py-1">Producto</th>
                    <th className="py-1 text-right">Cantidad</th>
                    <th className="py-1 text-right">Total</th>
                  </tr>
                </thead>
                {data.productos_por_categoria.map((g) => (
                  <tbody key={g.categoria} className="border-b">
                    <tr className="bg-muted/40">
                      <th
                        colSpan={3}
                        className="py-1 text-left text-xs font-semibold uppercase tracking-wide"
                      >
                        {g.categoria}
                      </th>
                    </tr>
                    {g.productos.map((p) => (
                      <tr key={`${g.categoria}-${p.nombre}`}>
                        <td className="py-1 pl-3">{p.nombre}</td>
                        <td className="py-1 text-right tabular-nums">{p.cantidad}</td>
                        <td className="py-1 text-right tabular-nums">{formatMoney(p.total)}</td>
                      </tr>
                    ))}
                    <tr className="text-xs font-medium">
                      <td className="py-1 pl-3">Subtotal {g.categoria}</td>
                      <td className="py-1 text-right tabular-nums">{g.cantidad}</td>
                      <td className="py-1 text-right tabular-nums">{formatMoney(g.total)}</td>
                    </tr>
                  </tbody>
                ))}
                <tfoot>
                  <tr className="font-bold">
                    <td className="py-1">
                      {data.productos_vendidos.length} producto
                      {data.productos_vendidos.length === 1 ? "" : "s"}
                    </td>
                    <td className="py-1 text-right tabular-nums">{data.unidades_totales}</td>
                    <td className="py-1 text-right tabular-nums">
                      {formatMoney(data.productos_vendidos.reduce((a, p) => a + p.total, 0))}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </Section>
          </>
        )}

        {data.hora_pico && (
          <>
            <Separator className="my-4" />
            <Section title="Hora pico">
              <p className="text-sm">
                {String(data.hora_pico.hora).padStart(2, "0")}:00 —{" "}
                {formatMoney(data.hora_pico.total)} en ventas
              </p>
            </Section>
          </>
        )}

        <Separator className="my-4" />
        <p className="text-center text-xs text-muted-foreground">
          Documento inmutable generado automáticamente.
        </p>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h2>
      {children}
    </div>
  );
}

function Row({
  label,
  value,
  bold,
  highlight,
}: {
  label: string;
  value: string;
  bold?: boolean;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className={`text-sm ${bold ? "font-bold" : "text-muted-foreground"}`}>{label}</span>
      <span
        className={`text-sm ${bold ? "font-bold" : "font-medium"} ${highlight ? "text-destructive" : ""}`}
      >
        {value}
      </span>
    </div>
  );
}
