// Mesas que este cliente acaba de tomar (TomarMesaButton): el realtime de /servicio no debe
// avisar "te asignaron una mesa" por una acción propia. Se limpian solas a los pocos segundos.
const tomadasPorMi = new Set<string>();

export function marcarTomadaPorMi(idMesa: string) {
  tomadasPorMi.add(idMesa);
  setTimeout(() => tomadasPorMi.delete(idMesa), 8_000);
}

export function desmarcarTomadaPorMi(idMesa: string) {
  tomadasPorMi.delete(idMesa);
}

export function fueTomadaPorMi(idMesa: string) {
  return tomadasPorMi.has(idMesa);
}
