# Calculadora de Presupuestos - WM

Proyecto simple para gestionar y calcular presupuestos de obra.

## Descripción

Aplicación web estática que contiene una calculadora de presupuestos, datos de rendimiento y plantillas auxiliares para elaboración de órdenes y fichas técnicas.

## Archivos principales

- `calculadora.html` — Interfaz principal de la calculadora.
- `app.js` — Lógica de la aplicación.
- `datos.js` — Datos y constantes usados por la calculadora.
- `wm_toast.js` — Notificaciones/toasts usados en la interfaz.
- `sw.js` — Service worker (caché/offline).
- `manifest.json` — PWA manifest.
- `documentacion e informacion/` — Carpeta con documentación y plantillas CSV/TXT.

## Cómo usar

1. Abrir `calculadora.html` en el navegador (doble clic o servidor local).
2. Revisar y editar `datos.js` para ajustar rendimientos o precios.
3. Usar las plantillas en `documentacion e informacion/` como referencia.

Para un entorno de desarrollo con recarga y servidor local se puede usar un servidor estático (por ejemplo, `npx http-server` o extensiones de Live Server en VS Code).

## Notas

Este repositorio no incluye una licencia explícita; preguntar al autor si se requiere una.
