"""Convierte las imágenes de assets-fuente/ a public/assets/ (WebP + AVIF, desktop y mobile).

Uso:  python scripts/optimizar-imagenes.py      (o npm run imagenes)
- Nunca agranda: si el original es más chico que el tamaño pedido, se usa el original.
- Borra todos los metadatos (EXIF/XMP: los exports de Canva traen nombre del autor e IDs).
- carteles/  → texturas 3D 16:9, solo WebP (1024×576 desktop · 512×288 mobile).
- fallback/  → imágenes HTML de la versión sin 3D, AVIF + WebP (1200×675 · 640×360), nombradas por id de etapa.
- recortes/  → PNG con transparencia → WebP con alfa, recortado al contenido.
Requiere Pillow con AVIF (pip install pillow).

No se publican (ver LEEME): ferias-mercado-ia (artefacto: manija pegada al portapapeles),
rubro-automotriz-ia (logo de una marca registrada), mapa-mundi, hombre-tablet-ia, reunion-banderas-ia, barco-cenital.
"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "assets-fuente"
OUT = ROOT / "public" / "assets"
QUALITY = {"avif": 52, "webp": 78}

# (origen, destino, foco vertical del recorte 16:9 [0 arriba … 1 abajo], tipo)
CARTELES = [
    ("apreton-manos.webp", "carteles/cartel-01", 0.2),
    ("reunion-acuerdo.webp", "carteles/cartel-02", 0.45),
    ("ferias-investigacion-ia.jpg", "carteles/feria-01", 0.5),
    ("ferias-stand-ia.jpg", "carteles/feria-02", 0.5),
    ("negociacion-ia.jpg", "carteles/negociacion-01", 0.5),
    ("calidad-ia.jpg", "carteles/calidad-01", 0.5),
]
FALLBACK = [
    ("ferias-investigacion-ia.jpg", "fallback/ferias", 0.5),
    ("negociacion-ia.jpg", "fallback/negociacion", 0.5),
    ("calidad-ia.jpg", "fallback/calidad", 0.5),
    ("operarios-patio.webp", "fallback/despacho", 0.5),
    ("barco-atardecer.webp", "fallback/transito", 0.5),
]
RECORTES = [("persona-caja-ia.webp", "recortes/persona-caja", 1024, 512)]


def clean(im, alpha=False):
    """Copia sin metadatos."""
    mode = "RGBA" if alpha else "RGB"
    out = Image.new(mode, im.size)
    out.paste(im.convert(mode))
    return out


def cover(im, ratio, focus):
    """Recorta al aspecto pedido, centrado en X y con foco vertical."""
    w, h = im.size
    if w / h > ratio:
        nw = round(h * ratio)
        x = (w - nw) // 2
        return im.crop((x, 0, x + nw, h))
    nh = round(w / ratio)
    y = round((h - nh) * focus)
    return im.crop((0, y, w, y + nh))


def fit_width(im, width):
    if im.width <= width:
        return im
    return im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)


def fit_height(im, height):
    if im.height <= height:
        return im
    return im.resize((round(im.width * height / im.height), height), Image.LANCZOS)


def save(im, dest, fmt):
    dest.parent.mkdir(parents=True, exist_ok=True)
    kw = {"quality": QUALITY[fmt]}
    if fmt == "webp":
        kw["method"] = 6
    if fmt == "avif":
        kw["speed"] = 4
    im.save(dest, fmt.upper(), **kw)
    return dest.stat().st_size


report = []


def emit(im, path, fmts):
    for fmt in fmts:
        p = OUT / f"{path}.{fmt}"
        report.append((p.relative_to(OUT).as_posix(), im.size, save(im, p, fmt)))


for src, dest, focus in CARTELES:
    im = cover(clean(Image.open(SRC / src)), 16 / 9, focus)
    emit(fit_width(im, 1024), f"{dest}-desktop", ("webp",))
    emit(fit_width(im, 512), f"{dest}-mobile", ("webp",))

for src, dest, focus in FALLBACK:
    im = cover(clean(Image.open(SRC / src)), 16 / 9, focus)
    emit(fit_width(im, 1200), f"{dest}-desktop", ("avif", "webp"))
    emit(fit_width(im, 640), f"{dest}-mobile", ("avif", "webp"))

for src, dest, hd, hm in RECORTES:
    im = clean(Image.open(SRC / src), alpha=True)
    im = im.crop(im.getchannel("A").getbbox())
    emit(fit_height(im, hd), f"{dest}-desktop", ("webp",))
    emit(fit_height(im, hm), f"{dest}-mobile", ("webp",))

# imagen para compartir en redes (1200×630, JPG para máxima compatibilidad)
og = cover(clean(Image.open(SRC / "barco-atardecer.webp")), 1200 / 630, 0.5).resize((1200, 630), Image.LANCZOS)
p = OUT / "og" / "og-laksmi.jpg"
p.parent.mkdir(parents=True, exist_ok=True)
og.save(p, "JPEG", quality=82, optimize=True, progressive=True)
report.append((p.relative_to(OUT).as_posix(), og.size, p.stat().st_size))

total = 0
for path, size, b in report:
    total += b
    print(f"{path:44} {size[0]:>5}x{size[1]:<5} {b / 1024:7.1f} KB")
print(f"{'total':44} {'':11} {total / 1024:7.1f} KB")
