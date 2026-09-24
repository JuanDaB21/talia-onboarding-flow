// Texto que el traductor del navegador NO debe reescribir: nombres de productos, categorías,
// extras y del negocio. La carta sí se deja traducir (turistas), pero "Mojito" o "Tomahawk"
// traducidos quedan mal y el cliente no los encuentra al pedir.
//
// `translate="no"` / `notranslate` solo lo respetan algunos traductores (Chrome sí; Safari iOS,
// Samsung Internet y otros no siempre). Por eso el texto visible sale de un pseudo-elemento CSS
// (`.texto-fijo::before { content: attr(data-texto-fijo) }`, en styles.css): no hay nodo de texto
// en el DOM, así que ningún traductor tiene qué cambiar. El lector de pantalla recibe el mismo
// texto por el `sr-only`.
import { cn } from "@/lib/utils";

export function TextoFijo({ texto, className }: { texto: string; className?: string }) {
  return (
    <>
      <span
        aria-hidden="true"
        translate="no"
        data-texto-fijo={texto}
        className={cn("notranslate texto-fijo", className)}
      />
      <span translate="no" className="notranslate sr-only">
        {texto}
      </span>
    </>
  );
}
