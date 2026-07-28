// Armado y encolado de las comandas de un pedido, una por estación.
//
// Vive aquí (y no en la ruta de la mesa) porque hay dos disparadores: el mesero
// al confirmar el pedido, y la aceptación de un pre-pedido sobre un pedido que
// YA estaba confirmado — en ese caso nadie más imprimiría esos items.
import { toast } from "sonner";
import { enqueueComandas } from "@/lib/impresion.functions";
import type { PedidoSesion } from "@/lib/servicio.functions";
import type { ComandaPrintData } from "@/components/preparacion/comanda-print";

/**
 * Encola las comandas de `pedido`, agrupadas por destino (una por estación).
 *
 * @param soloItems  Si se pasa, solo se imprimen esos `id_item`. Sirve para la
 *   aceptación de un pre-pedido sobre un pedido ya confirmado: la cocina debe
 *   recibir únicamente lo nuevo, no una reimpresión de toda la comanda.
 */
export function imprimirComandasDePedido(
  mesaIdentificador: string,
  mesero: string | null,
  pedido: PedidoSesion,
  soloItems?: string[],
) {
  const filtro = soloItems ? new Set(soloItems) : null;
  const items = filtro ? pedido.items.filter((i) => filtro.has(i.id_item)) : pedido.items;

  // Agrupa los items por su destino (cualquier slug de espacio) y crea una comanda por estación.
  const grupos = new Map<string, PedidoSesion["items"]>();
  items.forEach((i) => {
    const d = (i.destino ?? "COCINA").toUpperCase();
    const arr = grupos.get(d) ?? [];
    arr.push(i);
    grupos.set(d, arr);
  });
  const comandas: ComandaPrintData[] = Array.from(grupos.entries())
    .map(([destino, its]) => ({
      destino,
      mesa_identificador: mesaIdentificador,
      pedido_id: pedido.id_pedido,
      pedido_created_at: pedido.confirmado_at ?? pedido.created_at,
      mesero,
      items: its.map((it) => ({
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
  // Encola las comandas: las imprime el print-agent local del PC de impresoras.
  void enqueueComandas(comandas)
    .then((r) => {
      if (r.omitidos && r.omitidos.length > 0) {
        // El backend descarta los jobs de estaciones con requiere_impresora=false.
        // Antes se perdían en silencio y parecía que la comanda salía incompleta.
        toast.warning(`Sin impresora en ${r.omitidos.join(", ")}: esa comanda no se imprimió`, {
          description: "Actívala en Configuración → Impresión.",
        });
      }
      if (!r.agenteConectado) {
        toast.warning("No hay un agente de impresión conectado", {
          description: "La comanda quedó en cola y se imprimirá al reconectar el PC de impresoras.",
        });
      }
    })
    .catch((e) => {
      toast.error("No se pudo enviar la comanda a imprimir", {
        description: e instanceof Error ? e.message : undefined,
      });
    });
}
