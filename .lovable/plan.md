## Objetivo
Permitir al mesero editar o eliminar items individuales del pre-pedido antes de aceptarlo, sin perder el botón actual "Aceptar y enviar a la comanda".

## Cambios

### 1. Backend — `src/lib/prepedido.functions.ts`
Agregar dos nuevas server functions autenticadas (staff) que no requieren `idCliente` (el mesero puede tocar cualquier item de cualquier sesión de la mesa):

- `editarItemPrepedidoStaff` — `requireSupabaseAuth`. Recibe `{ idItem, cantidad, tieneAlergia, nota, extras, exclusiones }`. Valida que el item exista y que su mesa pertenezca al negocio del staff (vía `context.supabase` sobre `mesas`/`usuarios_staff`, respetando RLS). Reutiliza `validarExtrasYExclusiones`. Hace `UPDATE` con `supabaseAdmin`.
- `eliminarItemPrepedidoStaff` — `requireSupabaseAuth`. Recibe `{ idItem }`. Misma validación de pertenencia. Hace `DELETE` con `supabaseAdmin`.

Las funciones públicas existentes (`editarItemPrepedido`, `eliminarItemPrepedido` con `idCliente`) quedan intactas para los clientes.

### 2. Editor para staff — nuevo `src/components/servicio/prepedido-item-editor-staff.tsx`
Sheet equivalente al `PrepedidoItemEditor` del cliente pero:
- Solo se usa para editar (no agregar) — recibe siempre un `PrepedidoItem`.
- Llama `editarItemPrepedidoStaff` en lugar del fn público.
- Reutiliza `getOpcionesProductoPublico` (ya es público y solo necesita `idMesa + idProducto`, sirve para staff).
- Usa estilos shadcn estándar (no tokens de `--menu-*`) para encajar en la vista del mesero.
- Al guardar, invalida `["prepedidoMesa", idMesa]` y `["mesaSesion", idMesa]`.

### 3. UI — `src/components/servicio/prepedido-en-vivo-card.tsx`
Por cada item dentro de cada grupo de sesión, agregar acciones inline (iconos `Pencil` y `Trash2`) a la derecha del subtotal:
- **Editar:** abre el nuevo `PrepedidoItemEditorStaff` con ese item.
- **Eliminar:** confirma con `AlertDialog` y llama `eliminarItemPrepedidoStaff`; en éxito invalida queries y muestra toast.
- Estado local: `const [editing, setEditing] = useState<PrepedidoItem | null>(null)`.

El botón existente "Aceptar y enviar a la comanda" se conserva tal cual al fondo de la tarjeta.

## Notas técnicas
- Mantener `aceptarPrepedido` sin cambios.
- Verificar ownership: dentro del handler staff, `context.supabase.from('mesas').select('id_negocio').eq('id_mesa', item.id_mesa).single()` — si RLS no devuelve fila → throw "No autorizado".
- No tocar el flujo del cliente ni `PrepedidoSheet`.
