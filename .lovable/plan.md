## Goal

Add an async Printing Bridge Service that fires on order confirmation. It must run as a non-blocking background process — the existing `confirmar_pedido` RPC and UI flow stay unchanged. Failures are swallowed (logged) so service never stops.

## 1. New file: `src/services/printService.ts`

Pure client-side service (runs in the waiter's browser, after the server fn resolves).

```ts
export type PrintZone = 'barra' | 'cocina';

const PRINT_API_URL =
  import.meta.env.VITE_PRINT_API_URL || 'https://api.talia-printing-placeholder.local';

export async function sendPrintJob(payload: unknown, zone: PrintZone): Promise<{ ok: boolean }> {
  try {
    const res = await fetch(`${PRINT_API_URL}/print/${zone}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return { ok: true };
  } catch (err) {
    // Placeholder mode / network failure — log structured payload and continue.
    console.log(`[printService] (${zone}) placeholder payload`, { zone, payload, error: err });
    return { ok: false };
  }
}
```

Also export a helper that builds the segregated payloads and dispatches them with `Promise.allSettled`:

```ts
export interface PrintItem {
  nombre_producto: string;
  cantidad: number;
  notas_preparacion: string | null;   // nota + exclusiones, joined
  extras: { nombre: string; precio: number }[];
}
export interface PrintPayload {
  id_pedido: string;
  mesa_nombre_identificador: string;
  mesero_nombre: string | null;
  timestamp: string;
  items: PrintItem[];
}

export async function dispatchPrintJobsForPedido(input: {
  idPedido: string;
  mesaIdentificador: string;
  meseroNombre: string | null;
  items: Array<{
    destino: string | null;
    nombre_producto: string;
    cantidad: number;
    nota: string | null;
    exclusiones: { nombre: string }[];
    extras: { nombre: string; precio: number }[];
    variantes: { nombre_grupo: string; nombre_opcion: string }[];
  }>;
}): Promise<void> { /* split by destino, build payloads, fire allSettled */ }
```

Zone mapping: item `destino` is `"COCINA"` or `"BARRA"` (existing values) → lowercased to `'cocina'` / `'barra'`. Items with no `destino` default to `'cocina'` (matches current print behavior at line 140 of the route file). `notas_preparacion` = `nota` + variantes ("Con: …") + exclusiones ("Sin: …"), joined.

Conditional triggering: only zones with ≥1 item get a job. If both zones present, both fire independently via `Promise.allSettled`.

## 2. Hook into "Confirmar orden" — `src/routes/_app.servicio.$idMesa.tsx`

Only touch `confMut.onSuccess` (around line 280). The mutation already has access to `idPedido` (mutation var), `mesaQ.data` (mesa identificador + mesero), and the pedido's items.

```ts
const confMut = useMutation({
  mutationFn: (idPedido: string) => confFn({ data: { idPedido } }),
  onSuccess: (_r, idPedido) => {
    toast.success("¡Orden enviada a cocina/barra!", { ... });

    // Fire-and-forget print bridge — never blocks UI.
    const pedido = mesaQ.data?.pedidos.find((p) => p.id_pedido === idPedido);
    if (pedido && mesaQ.data) {
      void dispatchPrintJobsForPedido({
        idPedido,
        mesaIdentificador: mesaQ.data.identificador,
        meseroNombre: mesaQ.data.mesero_nombre,
        items: pedido.items,
      });
    }

    qc.invalidateQueries({ queryKey: ["mesaSesion", idMesa] });
  },
  onError: (e) => toast.error(...),
});
```

The server-side `confirmar_pedido` RPC is untouched. The local `imprimirComandasDePedido` (browser print dialog) stays as-is — it's separate from this API bridge.

## Technical notes

- Service lives in `src/services/` (new folder) — pure browser code, no server fn, no DB changes.
- Env var `VITE_PRINT_API_URL` is optional; default placeholder URL ensures fetch always attempts then catches.
- `Promise.allSettled` isolates barra vs cocina failures.
- No changes to: schemas, migrations, server functions, print HTML renderer, comanda-print.ts.

## Out of scope

- Real Print API contract (waiting on external spec — current JSON shape is the documented placeholder).
- Retry / queue / persistence of failed jobs.
- Server-side dispatch (kept in browser so it triggers exactly once per waiter confirmation).
