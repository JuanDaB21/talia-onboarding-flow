# Impresión de comandas (Talia)

Desde la Fase E, la impresión **ya no usa WebUSB del navegador** (ni Zadig/WinUSB).
En su lugar hay un **print-agent** local que corre en el PC con las impresoras
conectadas físicamente. Al confirmar un pedido (desde cualquier dispositivo), el
backend encola la comanda y la empuja por WebSocket a ese PC, que imprime en RAW
(ESC/POS) con el code page correcto.

## Cómo funciona

```
Cualquier dispositivo (web) --confirmar/reimprimir--> Backend (cola print_jobs)
   Backend --WS /print-agent--> print-agent (PC de impresoras) --> impresora física
   print-agent --ACK--> Backend (estado IMPRESO/ERROR, visible en Operación)
```

## Configuración (resumen)

1. **Configuración → Espacios de trabajo**: por cada espacio (COCINA, BARRA, CAJA y
   los que crees) ajusta **ancho de papel** (58/80mm) y **code page** (CP850/CP858
   para tildes y ñ). La impresora física se asigna en el agente, por el *slug* del
   espacio.
2. En la misma pantalla, sección **Agentes de impresión**: crea un agente y copia su
   **token** (se muestra una vez).
3. Instala y configura el **print-agent** en el PC de impresoras. Ver
   `print-agent/README.md` en el repo del backend (instalación, mapeo de impresoras
   por slug, autoarranque en Windows).

## Versión del agente

El agente se actualiza aparte del backend y degrada solo: uno viejo ignora los campos
que no conoce e imprime como siempre.

| Versión | Qué agrega |
|---|---|
| 0.5.0 | Cierre de caja con **productos agrupados por categoría** (con subtotal) y sección de **propinas**. Sin ella el cierre sale en lista plana y sin propinas. |
| 0.4.0 | Agrupa líneas iguales y detalla modificadores en comanda, precuenta y ticket. |
| 0.3.0 | Impresión del reporte de cierre (`tipo: 'cierre'`). |

## Monitoreo

En **Operación** el panel de *Impresión* muestra los trabajos con error (con botón
**Reintentar**) y los que están en cola (si el agente está desconectado).
