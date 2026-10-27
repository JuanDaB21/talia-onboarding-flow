/**
 * Deja el número listo para un link `wa.me`, que exige indicativo de país: quita todo lo no
 * numérico y, si son 10 dígitos (móvil colombiano típico), antepone el indicativo. "" si no hay.
 */
export function telefonoWa(telefono: string | null | undefined, indicativoDefault = "57"): string {
  const soloDigitos = (telefono ?? "").replace(/\D/g, "");
  if (!soloDigitos) return "";
  return soloDigitos.length === 10 ? indicativoDefault + soloDigitos : soloDigitos;
}

/** Enlace `wa.me` con mensaje prellenado; null si no hay número válido. */
export function enlaceWhatsApp(telefono: string | null | undefined, texto?: string): string | null {
  const tel = telefonoWa(telefono);
  if (!tel) return null;
  return texto ? `https://wa.me/${tel}?text=${encodeURIComponent(texto)}` : `https://wa.me/${tel}`;
}
