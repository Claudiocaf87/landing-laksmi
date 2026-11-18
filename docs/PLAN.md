# Landing 3D Laksmi Latam Group — plan aprobado (fase 1)

Base técnica reutilizada de `landing-luchador`: Vite + Three.js + GSAP/ScrollTrigger + Lenis,
timeline maestra con `u` (una unidad por etapa), cámara con curvas Catmull-Rom (posición y mira),
`Batch` para fusionar geometría estática por material, contenido en `src/content/es.json`
inyectado en el HTML, loader con porcentaje real y panel DEV.

## Narrativa (aprobada con 4 mejoras)

| # | Estado (HUD) | Escena |
|---|---|---|
| 00 | Pedido creado | Globo de puntos, oficinas en China, ruta estilizada a Latinoamérica |
| 01 | Plan aprobado | Mesa: la caja se arma; diagnóstico 48 h, estrategia, confidencialidad, 5 % fijo |
| 02 | Proveedor verificado | Showroom/feria → planta con cinta transportadora |
| 03 | Calidad verificada | Mesa de inspección, 100 % de las unidades |
| 04 | Cargado y precintado → Embarcado | Contenedor, precinto, grúa, barco |
| 05 | En tránsito | Océano, día → noche, minimapa de la ruta |
| 06 | Liberado en aduana | Descarga, contenedor en vista rayos X |
| 07 | Entregado | Depósito, camión, puerta del almacén |
| 08 | — | Se abre la caja → vuelta al globo con todas las rutas + cifras |
| — | — | Testimonios y FAQ (HTML) |
| — | — | Selector de perfil (antes del formulario) |
| 09 | — | Formulario + WhatsApp |

## Ajustes acordados

1. Tipografía opción A: Poppins (títulos y textos) + IBM Plex Mono (HUD y números). Alta solo en el logo.
2. Selector de perfiles antes del formulario.
3. Formulario: endpoint configurable (Formspree por defecto), imagen opcional con alternativa por WhatsApp,
   opciones de selects editables en `es.json` (deben coincidir con GHL). Webhook GHL en fase 4.
   Rangos de volumen sin "menos de 100K" hasta confirmar.
4. Ruta estilizada; los textos dicen "puertos de China"; `[PUERTO DE DESTINO]` como placeholder.
5. Métricas en fase 2: draw calls y triángulos por estación (u = i + 0,5), fps promedio y mínimos
   (normal y CPU 4x), peso gzip (JS vs. assets 3D), largo de scroll desktop y mobile.
6. Git: un commit al cerrar cada fase.
7. Fase 2 = escena gris; sin materiales finales ni postprocesado.

## Fases

1. Plan ✅
2. Escena gris de punta a punta (recorrido, anclas, HUD, textos, loader, menú mobile, formulario)
3. Iluminación, materiales, océano, partículas y postprocesado
4. Contenido real, mobile, fallbacks, rendimiento, webhook GHL
5. README
