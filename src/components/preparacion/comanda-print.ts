import { supabase } from "@/integrations/supabase/client";

export type ComandaDestino = "COCINA" | "BARRA";

export interface ComandaItemPrint {
  cantidad: number;
  nombre_producto: string;
  nombre_subcategoria?: string | null;
  tiene_alergia?: boolean;
  nota?: string | null;
  extras?: { nombre: string; cantidad?: number }[];
  exclusiones?: { nombre: string }[];
  variantes?: { nombre_grupo: string; nombre_opcion: string }[];
}

export interface ComandaPrintData {
  destino: ComandaDestino;
  mesa_identificador: string;
  pedido_id: string;
  pedido_created_at?: string | null;
  mesero?: string | null;
  items: ComandaItemPrint[];
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function fechaCorta(iso?: string | null): string {
  const d = iso ? new Date(iso) : new Date();
  return d.toLocaleString("es-CO", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function renderItem(it: ComandaItemPrint): string {
  const cant = it.cantidad > 1 ? `x${it.cantidad}` : "x1";
  const head = `<div class="item-head"><span class="qty">${cant}</span><span class="name">${escapeHtml(it.nombre_producto)}</span></div>`;
  const variantes = (it.variantes ?? [])
    .map(
      (v) =>
        `<div class="mod plus">▸ ${escapeHtml(v.nombre_grupo)}: ${escapeHtml(v.nombre_opcion)}</div>`,
    )
    .join("");
  const extras = (it.extras ?? [])
    .map(
      (e) =>
        `<div class="mod plus">+ ${escapeHtml(e.nombre)}${e.cantidad && e.cantidad !== 1 ? ` (${e.cantidad})` : ""}</div>`,
    )
    .join("");
  const excl = (it.exclusiones ?? [])
    .map((e) => `<div class="mod minus">- Sin ${escapeHtml(e.nombre)}</div>`)
    .join("");
  const alergia = it.tiene_alergia
    ? `<div class="alergia">!! ALERGIA — TOMAR PRECAUCIONES !!</div>`
    : "";
  const nota = it.nota
    ? `<div class="nota">Nota: ${escapeHtml(it.nota)}</div>`
    : "";
  return `<li class="item">${head}${variantes}${extras}${excl}${alergia}${nota}</li>`;
}

function renderItems(items: ComandaItemPrint[]): string {
  if (!items.length) return `<p class="empty">Sin items para esta estación.</p>`;
  // Asume items ya ordenados por subcategoría y nombre.
  const out: string[] = [];
  let currentSub: string | null | undefined = undefined;
  items.forEach((it) => {
    const sub = it.nombre_subcategoria ?? null;
    if (sub !== currentSub) {
      if (out.length) out.push(`</ul>`);
      out.push(
        `<div class="subcat">${escapeHtml(sub ?? "Otros")}</div><ul class="items">`,
      );
      currentSub = sub;
    }
    out.push(renderItem(it));
  });
  if (out.length) out.push(`</ul>`);
  return out.join("");
}

function renderComanda(c: ComandaPrintData, negocio: string): string {
  const items = renderItems(c.items);
  const mesero = c.mesero ? ` · ${escapeHtml(c.mesero)}` : "";
  const pedidoCorto = c.pedido_id.slice(0, 6);
  return `
<section class="comanda">
  <header>
    <div class="destino">${c.destino}</div>
    ${negocio ? `<div class="negocio">${escapeHtml(negocio)}</div>` : ""}
    <div class="mesa">Mesa ${escapeHtml(c.mesa_identificador)}</div>
    <div class="meta">${fechaCorta(c.pedido_created_at)}</div>
    <div class="meta">Pedido #${escapeHtml(pedidoCorto)}${mesero}</div>
  </header>
  <hr />
  ${items}
  <hr />
  <footer>── Fin de comanda ──</footer>
</section>`;
}

const STYLES = `
  @page { size: 90mm auto; margin: 4mm; }
  * { box-sizing: border-box; }
  html, body {
    margin: 0;
    padding: 0;
    width: 90mm;
    color: #000;
    background: #fff;
    font-family: "Courier New", ui-monospace, monospace;
    font-size: 12pt;
    line-height: 1.25;
  }
  .comanda { width: 100%; padding: 2mm 0; }
  .comanda + .comanda { page-break-before: always; }
  header { text-align: center; margin-bottom: 2mm; }
  .destino {
    font-size: 22pt;
    font-weight: 900;
    letter-spacing: 2px;
    border: 2px solid #000;
    padding: 2mm 0;
    margin-bottom: 2mm;
  }
  .negocio { font-size: 11pt; font-weight: bold; }
  .mesa { font-size: 16pt; font-weight: bold; margin-top: 1mm; }
  .meta { font-size: 9pt; }
  hr { border: none; border-top: 1px dashed #000; margin: 2mm 0; }
  ul.items { list-style: none; padding: 0; margin: 0 0 2mm 0; }
  .subcat {
    margin: 2mm 0 1mm 0;
    font-size: 11pt;
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: 1px;
    border-bottom: 1px solid #000;
    padding-bottom: 0.5mm;
  }
  li.item { padding: 2mm 0; border-bottom: 1px dotted #000; }
  li.item:last-child { border-bottom: none; }
  .item-head { display: flex; gap: 2mm; align-items: baseline; }
  .qty { font-weight: 900; font-size: 14pt; min-width: 10mm; }
  .name { font-weight: bold; font-size: 13pt; flex: 1; word-wrap: break-word; }
  .mod { font-size: 11pt; padding-left: 12mm; }
  .mod.plus { font-weight: bold; }
  .mod.minus { font-style: italic; }
  .alergia {
    margin-top: 1mm;
    margin-left: 12mm;
    padding: 1mm 2mm;
    border: 2px solid #000;
    font-weight: 900;
    text-align: center;
    font-size: 11pt;
  }
  .nota {
    margin-top: 1mm;
    padding-left: 12mm;
    font-size: 11pt;
    font-style: italic;
  }
  .empty { text-align: center; font-style: italic; padding: 4mm 0; }
  footer { text-align: center; font-size: 9pt; margin-top: 2mm; }
  .toolbar { text-align: center; padding: 8px; background: #f3f3f3; }
  .toolbar button {
    font-size: 14pt;
    padding: 8px 16px;
    cursor: pointer;
    border: 1px solid #000;
    background: #fff;
  }
  @media print { .toolbar { display: none; } }
`;

async function fetchNombreNegocio(): Promise<string> {
  try {
    const { data } = await supabase
      .from("negocio")
      .select("nombre_comercial")
      .limit(1)
      .maybeSingle();
    return (data?.nombre_comercial as string) ?? "";
  } catch {
    return "";
  }
}

/**
 * Abre una ventana con una o más comandas listas para imprimir.
 * Debe llamarse desde un evento de clic del usuario (popups bloqueables).
 */
export async function imprimirComandas(comandas: ComandaPrintData[]): Promise<void> {
  const w = window.open("", "_blank", "width=420,height=640");
  if (!w) {
    alert(
      "No se pudo abrir la ventana de impresión. Permite ventanas emergentes para este sitio.",
    );
    return;
  }
  // Render placeholder inmediato mientras se carga el nombre del negocio.
  w.document.open();
  w.document.write(
    `<!doctype html><html><head><meta charset="utf-8"><title>Comanda</title></head><body><p style="font-family:sans-serif;padding:1rem">Preparando comanda…</p></body></html>`,
  );
  w.document.close();

  const negocio = await fetchNombreNegocio();
  const titulo = `Comanda${comandas.length > 1 ? "s" : ""} — ${comandas.map((c) => c.destino).join(" + ")}`;
  const body = comandas.map((c) => renderComanda(c, negocio)).join("");
  const html = `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(titulo)}</title>
  <style>${STYLES}</style>
</head>
<body>
  <div class="toolbar">
    <button type="button" onclick="window.print()">Imprimir</button>
  </div>
  ${body}
  <script>
    window.addEventListener('load', function () {
      setTimeout(function () { window.focus(); window.print(); }, 200);
    });
  </script>
</body>
</html>`;
  w.document.open();
  w.document.write(html);
  w.document.close();
}
