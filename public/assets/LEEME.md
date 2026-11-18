# Assets reemplazables

Mantené los nombres de archivo para no tocar código. Los textos alternativos están en
`src/content/es.json → imagenes`. Para regenerar las versiones optimizadas a partir de los
originales (`assets-fuente/`, fuera de git): `python scripts/optimizar-imagenes.py`.

**Reglas generales**
- Cada imagen va en dos tamaños: `-desktop` y `-mobile`. Las de HTML, en `.avif` + `.webp`.
  Las texturas del 3D, solo en `.webp`.
- Nada de esto se carga en el hero. Las texturas 3D se piden después del primer fotograma y las de
  HTML con `loading="lazy"`. Así la carga inicial no cambia (hoy, ~230 KB gzip de código + 21 KB de datos 3D).
- Sin metadatos: el script los borra (los exports de Canva traen nombre del autor e IDs de documento).
- Nunca agrandar: si el original es chico, se publica a su tamaño.

## Estado actual

Origen: **stock** = banco de imágenes; **IA** = generada. Ninguna muestra al equipo ni a clientes de Laksmi:
van sin leyendas que afirmen nada (ver `es.json → imagenes.nota`).

| Archivo | Uso | Medida | Peso máx. | Origen |
|---|---|---|---|---|
| `logo/logo-color.webp/png` | Header, loader (fondos claros) | 410×234 | 60 KB | marca |
| `logo/logo-blanco.webp/png` | Footer azul | 410×234 | 40 KB | marca |
| `logo/favicon.png` | Pestaña | 64×64 | 10 KB | marca |
| `og/og-laksmi.jpg` | Vista previa al compartir | 1200×630 | 200 KB | IA probable |
| `data/globo-puntos.bin` | Tierra del globo (Natural Earth) | — | 40 KB | dominio público |
| `carteles/feria-01-*.webp` | Banderola y stands de la feria | 1024×576 / 512×288 | 120 KB | IA |
| `carteles/feria-02-*.webp` | Banderola y stands de la feria | 1024×576 / 512×288 | 120 KB | IA |
| `carteles/negociacion-01-*.webp` | Stands / etapa de negociación | 1024×576 / 512×288 | 120 KB | IA |
| `carteles/calidad-01-*.webp` | Pantalla de la planta (hasta que llegue el video) | 1024×576 / 512×288 | 120 KB | IA |
| `carteles/cartel-01-*.webp` | Stand de la feria | 512×288 | 60 KB | stock |
| `carteles/cartel-02-*.webp` | Stand de la feria | 512×288 | 60 KB | stock |
| `recortes/persona-caja-*.webp` | Foto recortada en la entrega (trae mesa y caja) | 707×1024 / 354×512 | 250 KB | IA |
| `fallback/ferias-*.{avif,webp}` | Versión sin 3D | 1200×675 / 640×360 | 120 KB | IA |
| `fallback/negociacion-*` · `calidad-*` | Versión sin 3D | 1200×675 / 640×360 | 120 KB | IA |
| `fallback/despacho-*` | Versión sin 3D | 512×288 | 120 KB | stock |
| `fallback/transito-*` | Versión sin 3D | 1200×675 / 640×360 | 120 KB | IA probable |

**No se publican:** mercado mayorista (artefacto de IA: una manija pegada al portapapeles),
auto de lujo (muestra el logo de una marca registrada), mapamundi, hombre con tablet y reunión con banderas
(IA con texto y banderas erróneas), buque cenital (baja resolución).

## Lo que falta (con medidas)

| Archivo | Qué tiene que mostrar | Medida y formato | Peso máx. |
|---|---|---|---|
| `recortes/persona-caja.png` | Una persona real (cliente o equipo, con permiso de imagen) abriendo una caja de cartón, de cuerpo entero o de rodillas, vista 3/4, **fondo eliminado**, luz lateral suave. | 1000×2000 px (1:2 vertical), PNG con transparencia; se publica como `.webp` con alfa | 250 KB (webp) |
| `video/planta.mp4` + `video/planta.webm` | Toma real del equipo en una fábrica o inspeccionando mercancía en China. Loop sin corte visible, **sin audio**, sin texto sobreimpreso. | 1280×720 (16:9), 8–15 s, 24/30 fps; MP4 H.264 ~1,5 Mbps + WebM VP9 | 2,5 MB (mp4) / 2 MB (webm) |
| `video/planta-poster.webp` | Primer fotograma del video (se muestra mientras carga) | 1280×720 | 80 KB |
| `carteles/cartel-03` … `cartel-10` | Stands en Feria de Cantón o Mercado de Yiwu, productos por rubro, oficinas en China | 1024×576 (16:9) desktop · 512×288 mobile, WebP | 120 KB |
| `productos/<rubro>-{desktop,mobile}.webp` | Un producto por rubro: ferretería, médico, automotriz, bisutería, tecnología. Fondo neutro. | 800×800 / 480×480 | 90 KB |
| `fotos/equipo-*.webp`, `fotos/oficina-*.webp` | Equipo y oficinas reales (Caracas, Margarita, Yiwu, Guangzhou, Ningbo, Shantou) | 1600×1067 (3:2) / 800×533 | 220 KB |
| `fotos/testimonio-<nombre>.webp` | Retrato de cada testimonio (solo con permiso) | 400×400 | 40 KB |
| `fotos/feria-canton-*.webp` | **Fotos reales del equipo en la Feria de Cantón** (etapas de ferias y negociación), con leyenda [FERIA, AÑO, QUIÉN ES] | 1600×1067 / 800×533 | 220 KB |
| `productos/automotriz-*.webp` | Producto del rubro automotriz sin marcas visibles (repuesto, herramienta) | 800×800 / 480×480 | 90 KB |
| `fallback/<id>-*` restantes | Imagen fija por etapa para la versión sin 3D: se generan como capturas de la escena en la fase 4 | 1200×675 / 640×360 | 120 KB |
| `logo/logo.svg` | Logo vectorial (versión color y blanca) | SVG | 30 KB |
