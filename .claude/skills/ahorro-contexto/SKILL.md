---
name: ahorro-contexto
description: Cómo gastar el mínimo de contexto y tokens trabajando en el front de Talia — qué leer, cómo explorar sin recorrer node_modules ni el árbol de rutas entero, cómo procesar salidas grandes, y qué herramientas de terceros están evaluadas. Úsalo al empezar una sesión, antes de explorar el código, o cuando pidan "ahorrar tokens" o "no gastar contexto".
---

# Ahorro de contexto en el front de Talia

Aplicación de `GUIA_AHORRO_TOKENS.md`. Regla mental: **cada byte que devuelve una herramienta se
queda en la conversación y cuesta capacidad de razonamiento el resto de la sesión.**

## 1. Lo que ya está resuelto — no re-derivarlo

Lee esto y confía en ello antes de explorar:

1. `CLAUDE.md` (raíz) — stack, topología de dos repos, layout, convenciones, comandos.
2. `CUTOVER.md` — estrategia de ramas y regla anti-regresión Supabase.
3. `IMPRESORAS.md` — impresión / print-agent.
4. `src/lib/query-config.ts` — convención de queryKeys y presets de polling (está documentado
   en su cabecera; léela, no la reconstruyas).
5. El contrato de la API está en `SPEC.md` **del repo del backend** (`../talia/SPEC.md`).
   Búscalo con `grep`, no lo leas entero.

Si algo quedó desactualizado, **corrígelo ahí** en vez de re-derivarlo cada sesión. Ese es el
mayor ahorro del proyecto.

## 2. Explorar barato

| En vez de | Haz |
|---|---|
| Listar `src/routes/` para ubicarte | Ya está el mapa en `CLAUDE.md`; usa Glob con el patrón exacto |
| Leer una ruta `_app.*.tsx` completa | `grep -n "useQuery\|useMutation\|functions" <archivo>` y leer el rango |
| Buscar dónde se llama un endpoint | `grep -rn "<ruta-api>" src/lib` — el data-access está todo ahí |
| Leer `routeTree.gen.ts` | Nunca: es generado |
| `find` sobre el repo | Glob, o `find` con `-not -path '*/node_modules/*'` |

**Nunca** recorras `node_modules/`, `.output/`, `dist/`, `src/components/ui/` completo (son
componentes shadcn estándar) ni `routeTree.gen.ts`.

## 3. Salidas grandes: procesar, no volcar

Para `npm run build`, logs, `git log`, respuestas de API: usa el sandbox de `context-mode`
(`ctx_batch_execute` / `ctx_execute` / `ctx_execute_file`) e imprime **solo la conclusión**.

- Bash directo sigue siendo correcto para salidas **cortas y fijas** (`git status` limpio) y para
  **mutar estado** (`git`, `mv`, `mkdir`).
- Bash es incorrecto cuando la intención es **filtrar, contar, parsear o agregar**.
- Documentación externa: `ctx_fetch_and_index` + `ctx_search`, no volcar la página.
- Tras `/compact` o al retomar: `ctx_search(sort: "timeline")` antes de preguntar al usuario.

## 4. Cambios repetitivos

Un cambio que se repite en 15 rutas (`_app.*.tsx`) se hace con un script parametrizado y se
verifica con `grep`, no editando 15 archivos a mano leyendo cada uno completo.

## 5. Salida hacia el usuario

Español, directo, sin preámbulos ni cierres de relleno. Viñetas antes que párrafos. Se preserva
textual: código, comandos, rutas, errores, cifras y nombres propios. Los artefactos van a
archivos; en la respuesta, la ruta y una línea.

## 6. Herramientas de terceros — política

Un plugin o servidor MCP puede ver y reescribir las llamadas y resultados de herramientas, y sus
instaladores ejecutan código remoto.

- **Nada se instala sin aprobación explícita del usuario.**
- **Una sola base con hooks `PreToolUse`/`PostToolUse`**: hoy es `context-mode`. Por eso este
  repo no define hooks propios.
- Catálogo de referencia: <https://github.com/hesreallyhim/awesome-claude-code>. Lo que se
  adopte se traduce a activos locales en `.claude/`, no se instala a ciegas.
- Tabla completa de herramientas evaluadas: `talia-backend/docs/METODOLOGIA-CLAUDE.md`.
