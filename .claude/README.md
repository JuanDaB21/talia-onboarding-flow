# `.claude/` — Metodología de trabajo con Claude Code (front)

Proceso versionado. Si cambia la forma de trabajar, se cambia aquí, no en el prompt de cada
sesión. El porqué y el criterio de adopción están en el repo del backend:
`talia-backend/docs/METODOLOGIA-CLAUDE.md`.

| Activo | Qué es | Cuándo se dispara |
|---|---|---|
| `skills/modulo-datos/` | Acceso a datos por `src/lib/*.functions.ts` → `api-client` | Al tocar datos, formularios o una pantalla nueva |
| `skills/realtime-incremental/` | Patch al cache de TanStack Query, nunca refetch total | Al tocar `realtime-client` o suscripciones |
| `skills/merge-lovable/` | `main → deployment` sin reintroducir Supabase | Al traer avances de Lovable |
| `skills/revision-front/` | Auditoría del diff contra los contratos | Antes de abrir PR |
| `skills/ahorro-contexto/` | Cómo gastar el mínimo de contexto en este repo | Siempre (regla base) |
| `commands/merge-lovable.md` | `/merge-lovable` — el merge guiado | Manual |
| `commands/contratos-front.md` | `/contratos-front` — auditoría del diff | Manual |
| `commands/sync.md` | `/sync` — sincroniza este repo y el del backend | Manual |
| `agents/revisor-front.md` | Subagente revisor de solo lectura | Lo invoca `/contratos-front` |

## Reglas de la capa

1. **Sin hooks `PreToolUse`/`PostToolUse` propios.** La base de optimización de contexto es el
   plugin `context-mode`, que ya los registra; dos sistemas se pisan.
2. **Del ecosistema se adopta el patrón, no el paquete.** Lo útil de
   [awesome-claude-code](https://github.com/hesreallyhim/awesome-claude-code) se traduce a
   activos locales (texto revisable en el PR). Instalar plugins/MCP de terceros exige aprobación
   explícita del usuario.
3. **Los skills describen este repo**, no buenas prácticas genéricas: rama `deployment`,
   anti-regresión Supabase, `*.functions.ts`, presets de `query-config.ts`.
