# Impresión de comandas (térmica USB)

Talia imprime las comandas **directamente** desde el navegador a la impresora
térmica USB usando **WebUSB + ESC/POS** (sin drivers de servidor, sin apps
extra). La comanda sale **sola** cada vez que el mesero **confirma/envía un
pedido a cocina** — no hay que tocar nada más.

## Requisitos

- **Chrome, Edge u Opera de escritorio** (Windows/Mac/Linux). No funciona en
  Safari ni en móviles (`navigator.usb` no existe ahí).
- Una impresora térmica USB (58 mm o 80 mm) conectada al PC de la
  caja/cocina.

## Configuración por PC (una sola vez)

### 1. Cambiar el driver a WinUSB (solo Windows)

Si al **Probar** la impresora aparece **"Windows tiene tomada la impresora"**
o **"acceso denegado"**, es porque Windows la reclama con su propio driver de
impresión y el navegador no puede acceder. Hay que cambiarlo a **WinUSB**:

1. Descargar **Zadig**: https://zadig.akeo.ie
2. Abrir Zadig → menú `Options` → **List All Devices**.
3. En la lista, seleccionar la impresora térmica.
4. Elegir el driver **WinUSB** y pulsar **Replace Driver**.
5. Desconectar y reconectar la impresora.

> Tras esto, la impresora **deja de aparecer** como impresora del sistema en
> Windows. Es lo esperado: ahora la maneja Talia vía WebUSB. Si algún día se
> quiere volver a usarla con Windows, se revierte el driver desde el
> Administrador de dispositivos.

### 2. Vincular la impresora en Talia

1. Entrar como **ADMIN**/**SUPERADMIN**.
2. Ir a **Configuración → Espacios de trabajo**.
3. En cada estación (ej. **COCINA**, **BARRA**) pulsar **Vincular** y elegir la
   impresora en el diálogo del navegador.
4. Ajustar el **ancho de papel** (58 u 80 mm).
5. Pulsar **Probar** → debe salir un ticket de prueba de Talia.

El vínculo se guarda **por navegador/perfil** (en `localStorage`). Usar siempre
el **mismo PC + mismo perfil de Chrome** en la caja/cocina.

## Cómo funciona el auto-print

Al **confirmar un pedido** (botón *Confirmar / enviar a cocina*), Talia:

1. Agrupa los items por su **estación de destino** (COCINA, BARRA, …).
2. Envía cada comanda a la **impresora vinculada de esa estación**, en
   silencio y sin diálogos.
3. Si una impresora está apagada/desconectada o falla, registra una **alerta**
   en **Operación en vivo → Alertas de impresión** (con opción de reintentar o
   imprimir en ventana del navegador). El servicio nunca se bloquea por la
   impresión.

## Solución de problemas

| Mensaje | Causa | Solución |
|---|---|---|
| "Windows tiene tomada la impresora" / "acceso denegado" | Driver de impresión de Windows activo | Cambiar a WinUSB con Zadig (paso 1) |
| "Este navegador no soporta impresión USB" | Safari/móvil o navegador no Chromium | Usar Chrome/Edge/Opera de escritorio |
| "Impresora desconectada o apagada" | Cable/energía | Revisar conexión y reintentar desde Alertas |
| "La impresora está ocupada por otra app o pestaña" | Otra pestaña/app la tomó | Cerrar la otra pestaña/app y reintentar |
