export function formatMoney(n: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(n || 0);
}

/**
 * Fecha `YYYY-MM-DD` en la zona horaria LOCAL del dispositivo.
 *
 * No usar `toISOString().slice(0,10)` para esto: devuelve la fecha en UTC, así
 * que en Colombia (UTC−5) a partir de las 19:00 ya da el día siguiente — justo
 * en horario de cena. `en-CA` produce el formato ISO respetando la zona local.
 */
export function fechaLocalISO(d: Date = new Date()): string {
  return d.toLocaleDateString("en-CA");
}
