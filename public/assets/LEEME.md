# Assets reemplazables

La landing es una historia fotográfica guiada por scroll; lo único en 3D es el globo.
Los textos alternativos, el orden de las fotos y el **punto focal** de cada una están en
`src/content/es.json` (`etapas[].fotos[]`, `etapas[].recorte`, `rubros.items[]`).

**Para reemplazar una foto:** poné el original en `assets-fuente/<id>.jpg` (mismo nombre, mínimo
2000×1116, 16:9) y corré `npm run imagenes`. El script genera las versiones desktop y mobile, en AVIF y
WebP, sin metadatos y dentro del peso máximo. El recorte vertical para mobile se centra en el punto
focal de `es.json` (por ejemplo `"60% 40%"` = 60 % desde la izquierda, 40 % desde arriba).
Si cambia el globo: `npm run build && npm run globo-imagen && npm run imagenes`.

**Reglas**
- Desktop: 1920 px de ancho, ≤ 250 KB. Mobile: 900×1600 (vertical 9:16), ≤ 120 KB. Formato AVIF + WebP.
- Se carga solo la foto de la etapa actual y la siguiente (nada en el hero salvo el globo).
- Todas las fotos de esta muestra son **generadas con IA**: no muestran al equipo, a clientes ni a
  lugares reales de Laksmi, y no llevan leyendas que lo afirmen.
- Los originales miden 1116 px de alto, así que el recorte vertical de mobile (628 px de ancho)
  se agranda 1,43× hasta 900 px. Con originales de ≥ 1600 px de alto no haría falta.

## Fotos (en `fotos/`)

| Archivo (`<id>-desktop|mobile.avif|webp`) | Etapa | Punto focal | Desktop | Mobile |
|---|---|---|---|---|
| `plan` | 01 Plan | 40% 35% | 1920×1071 | 900×1600 |
| `feria-01` | 02 Ferias (1/3) | 40% 40% | 1920×1071 | 900×1600 |
| `feria-02` | 02 Ferias (2/3) | 60% 40% | 1920×1071 | 900×1600 |
| `feria-detalle` | 02 Ferias (3/3), frase "Anotamos cada muestra." | 62% 50% | 1920×1071 | 900×1600 |
| `negociacion` | 03 Negociación (los dos estados) | 52% 40% | 1920×1071 | 900×1600 |
| `calidad` | 04 Calidad | 55% 42% | 1920×1071 | 900×1600 |
| `carga` | 05 Despacho (1/3) | 70% 50% | 1920×1071 | 900×1600 |
| `precinto` | 05 Despacho (2/3) · **provisional**: muestra un candado; reemplazar con el mismo nombre | 58% 55% | 1920×1071 | 900×1600 |
| `puerto` | 05 Despacho (3/3) | 55% 45% | 1920×1071 | 900×1600 |
| `transito` | 06 Tránsito (+ mapa grande) | 48% 55% | 1920×1071 | 900×1600 |
| `aduana` | 07 Aduana | 39% 45% | 1920×1071 | 900×1600 |
| `entrega` | 08 Entrega | 62% 55% | 1920×1071 | 900×1600 |
| `persona-caja` | 09 Resultados (PNG recortado, con transparencia) | — | 707×1024 | 497×720 |
| `globo-hero` · `globo-cierre` | 00 y 09, solo sin WebGL / ahorro de datos / gama baja (capturas del globo 3D) | — | 900×900 | 600×600 |
| `rubro-automotriz` | Bloque Rubros (cuadrada) | 47% 50% | 800×800 | 480×480 |

`og/og-laksmi.jpg` (1200×630): vista previa al compartir, recortada de `transito`.
`data/globo-puntos.bin`: tierra del globo (Natural Earth, dominio público; `npm run globo`).
`logo/`: `logo-color` (fondos claros), `logo-blanco` (footer azul), `favicon.png`.

## Lo que falta

| Archivo | Qué tiene que mostrar | Medida y formato |
|---|---|---|
| `assets-fuente/precinto.jpg` | Precinto de seguridad real (no un candado) en las puertas de un contenedor | ≥ 2000×1116 |
| `assets-fuente/rubro-ferreteria.jpg` · `-medico` · `-bisuteria` · `-tecnologia` | Un producto por rubro, fondo claro, sin marcas | ≥ 1200×1200 |
| Fotos reales del equipo en la Feria de Cantón | Para las etapas de ferias y negociación, con leyenda [FERIA, AÑO, QUIÉN ES] | ≥ 2000 px de ancho |
| `video/feria.mp4` + `feria.webm` | Si llega un video de la feria: 1280×720, 8–15 s en loop, sin audio | ≤ 2,5 MB / ≤ 2 MB |
| `logo/logo.svg` | Logo vectorial (color y blanco) | SVG |
