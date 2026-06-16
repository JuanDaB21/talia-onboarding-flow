## Objetivo

Arreglar dos problemas en el menú público (`/carta/:idMesa`):

1. El título del restaurante se desborda en el header cuando el nombre es largo.
2. El sheet del carrito (icono de bolsa arriba a la derecha) no abre al pulsarlo.

---

## 1. Ajuste automático del título en el header

**Archivo:** `src/routes/carta.$idMesa.tsx` — componente `ThemedHeader` (4 variantes: `hero-centrado`, `banner-gradiente`, `editorial`, `minimal`).

Hoy cada variante usa un tamaño fijo (`text-3xl` / `text-2xl` / `text-lg`) con `truncate`, así que un nombre como "Restaurante Las Delicias de la Abuela" se corta o se sale del logo.

Cambios:

- Quitar `truncate` del `<h1>` del nombre y permitir wrap en máximo 2 líneas con `line-clamp-2` + `break-words`.
- Reemplazar el tamaño fijo por una escala fluida con `clamp()` para que se reduzca automáticamente según el ancho disponible:
  - Hero centrado: `clamp(1.25rem, 6vw, 1.875rem)`
  - Banner gradiente: `clamp(1.125rem, 5.5vw, 1.5rem)`
  - Editorial: `clamp(1.5rem, 7vw, 1.875rem)`
  - Minimal: `clamp(1rem, 4.5vw, 1.25rem)`
- Asegurar `min-w-0` en el contenedor flex padre para que el flex item pueda encogerse.
- Mantener `leading-tight` y `font-bold`.

No cambia layout, colores ni tipografía del tema.

## 2. El sheet del carrito no abre

**Síntoma:** al tocar el botón flotante (bolsa) arriba a la derecha no aparece nada.

**Investigación en build mode:**

1. Reproducir con Playwright contra `localhost:8080/carta/<idMesa>` haciendo onboarding y luego click en el botón de la bolsa; capturar consola y screenshots.
2. Confirmar la causa entre las dos hipótesis más probables:
   - **(a)** `cliente?.idSesion` aún no está cuando se monta el botón, así que `<PrepedidoSheet>` no se renderiza en el DOM y `setPrepedidoOpen(true)` no hace nada visible. (La condición está en `carta.$idMesa.tsx` líneas 510–522.)
   - **(b)** El error de React #419 visto en runtime crashea el árbol al abrir el Sheet por el `PrepedidoItemEditor` interno (`prepedido-sheet.tsx` líneas 258–268) que se monta como sibling del SheetContent y a la vez también se monta en la ruta padre (línea 524 de `carta.$idMesa.tsx`) — dos editores con el mismo `producto={null}` viviendo a la vez.

**Plan de corrección probable:**

- **Caso (a):** mover el `<PrepedidoSheet>` fuera del bloque condicional `cliente?.idSesion` (renderizarlo siempre, con `data` opcional) y deshabilitar el botón hasta tener sesión, o usar `<button disabled>` con estilo atenuado.
- **Caso (b):** eliminar el `<PrepedidoItemEditor>` duplicado dentro de `prepedido-sheet.tsx` (líneas 258–268) y manejar la edición vía un callback `onEdit(item)` que el padre (`carta.$idMesa.tsx`) recibe y abre con el editor único ya existente en líneas 524–535. Esto deja un solo editor montado en el árbol y elimina el conflicto de Sheets anidados/duplicados que provoca el error de hidratación/cliente.

La fix concreta se decide tras la reproducción, pero la dirección es: **un único editor montado en la ruta padre, sheet del carrito siempre montado pero con CTA deshabilitado si no hay sesión.**

## Archivos afectados

- `src/routes/carta.$idMesa.tsx` (header + montaje del sheet)
- `src/components/menu-publico/prepedido-sheet.tsx` (quitar editor interno, exponer `onEdit`)

## Lo que NO se toca

- Server functions de prepedido (`src/lib/prepedido.functions.ts`).
- Esquema de base de datos.
- Temas, colores ni tipografías.
- Lógica de pedido / cuenta / llamar mesero.
