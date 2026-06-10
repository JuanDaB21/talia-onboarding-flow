## Asistente IA para staff (solo lectura)

Chatbot flotante accesible desde cualquier página del panel. Solo para usuarios staff autenticados. Responde preguntas sobre el restaurante consultando la base de datos vía herramientas con permisos limitados a su `id_negocio`.

### Alcance

- **Audiencia**: staff autenticado (admin/dueño/mesero/cocina según rol).
- **Acceso**: botón flotante (FAB) en esquina inferior derecha, visible en todo el layout `_app/*`. Oculto en rutas públicas (`/carta/:idMesa`, `/login`, `/register`).
- **Conversación**: una sola conversación por usuario, persistida en `localStorage` por simplicidad (clave `talia-chat-{userId}`). Botón "Nueva conversación" la limpia.
- **Capacidades**: solo lectura. El bot puede consultar pero no modificar datos.

### Qué puede responder

El bot tendrá un set de herramientas (tools del AI SDK) que el modelo invoca según la pregunta, todas con `id_negocio` derivado del staff autenticado:

1. `get_ventas_resumen({ desde, hasta })` — ventas, ticket promedio, transacciones.
2. `get_productos_top({ desde, hasta, limit })` — productos más vendidos.
3. `get_stock_bajo()` — insumos bajo el mínimo.
4. `get_mesas_estado()` — mesas ocupadas, libres, con llamado.
5. `get_pedidos_activos()` — pedidos en curso por estado.
6. `get_turnos_activos()` — staff en turno ahora.
7. `get_caja_dia()` — caja actual abierta (ingresos, egresos, propinas).
8. `buscar_producto({ query })` — busca en el menú por nombre.

Cada tool es un `createServerFn` con `requireSupabaseAuth` que valida el `id_negocio` del usuario antes de leer. Reutiliza patrones existentes (similar a `analytics.functions.ts`).

### UI

- **Componente `FloatingChatButton`**: FAB con ícono de chat en `_app.tsx`, abre un `Sheet` lateral derecho (o dialog en móvil).
- **Componente `ChatPanel`** dentro del Sheet: usa AI Elements (`Conversation`, `Message`, `MessageResponse`, `PromptInput`, `Tool`, `Shimmer`).
- Mensajes del asistente sin fondo; mensajes del usuario con `bg-primary text-primary-foreground`.
- Render de `message.parts` (texto + tool calls colapsadas).
- Logo: pequeño avatar generado (no `Sparkles`). Se puede usar el logo del negocio si existe.
- Empty state con sugerencias rápidas: "¿Cuáles son mis productos más vendidos esta semana?", "¿Qué insumos están bajos?", "¿Cómo van las ventas hoy?".

### Backend

- **Server route streaming**: `src/routes/api/chat.ts` con `POST` handler. Verifica auth leyendo bearer del header (vía `attachSupabaseAuth` ya configurado), obtiene `id_negocio` del staff, llama a `streamText` del AI SDK con tools registradas.
- **Modelo**: `google/gemini-3-flash-preview` vía Lovable AI Gateway (sin API key del usuario).
- **Provider helper**: nuevo `src/lib/ai-gateway.server.ts` con `createLovableAiGatewayProvider` (patrón canónico).
- **System prompt**: contexto sobre el negocio (nombre, rol del usuario, fecha actual), instrucciones para usar tools antes de responder, responder en español, ser conciso.
- **stopWhen**: `stepCountIs(50)` para permitir múltiples tool calls.

### Persistencia

- `localStorage` clave `talia-chat-{userId}` con `UIMessage[]`.
- Bootstrap idempotente con guard `typeof window !== "undefined"`.
- No se guarda en BD (decisión del usuario).

### Archivos a crear

- `src/lib/ai-gateway.server.ts` — helper del provider.
- `src/lib/chat-tools.server.ts` — definiciones de tools (server-only).
- `src/routes/api/chat.ts` — endpoint streaming.
- `src/components/chat/floating-chat-button.tsx` — FAB.
- `src/components/chat/chat-panel.tsx` — UI del chat con AI Elements.
- `src/hooks/use-chat-storage.ts` — hook de persistencia localStorage.

### Archivos a editar

- `src/routes/_app.tsx` — montar `<FloatingChatButton />`.
- `package.json` — agregar `ai`, `@ai-sdk/react`, `@ai-sdk/openai-compatible`, `zod` (si falta).

### Detalles técnicos

- **Seguridad**: cada tool re-valida que el `id_negocio` solicitado coincida con el del staff autenticado (defensa en profundidad además de RLS).
- **Errores**: 429 → toast "Demasiadas solicitudes, intenta en un momento"; 402 → toast "Créditos de IA agotados, contacta al admin".
- **AI Elements**: instalar con `bunx ai-elements@latest add conversation message prompt-input shimmer tool`.
- **LOVABLE_API_KEY**: verificar que existe; si no, crearlo con la tool correspondiente al implementar.

### Fuera de alcance

- Sin acciones de escritura (no crea pedidos, no cierra mesas).
- Sin hilos múltiples ni sidebar de conversaciones.
- Sin chatbot para clientes en `/carta/:idMesa` (queda para una segunda fase si lo piden).
- Sin voz, sin adjuntos, sin generación de imágenes.
