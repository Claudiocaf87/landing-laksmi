"""Convierte las imágenes de assets-fuente/ a public/assets/ (WebP + AVIF, desktop y mobile).

Uso:  python scripts/optimizar-imagenes.py
- Nunca agranda: si el original es más chico que el tamaño pedido, se usa el original.
- Borra todos los metadatos (EXIF/XMP: los exports de Canva traen nombre del autor e IDs).
- Los carteles 3D son texturas 16:9 (solo WebP); las de fallback/og son para HTML (AVIF + WebP / JPG).
Requiere Pillow con AVIF (pip install pillow).
"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "assets-fuente"
OUT = ROOT / "public" / "assets"

# (origen, destino sin extensión, recorte (x0,y0,x1,y1) o None, ancho desktop, ancho mobile, formatos)
JOBS = [
    ("barco-atardecer.webp", "fallback/etapa-05", None, 1200, 640, ("avif", "webp")),
    ("operarios-patio.webp", "fallback/etapa-04", None, 1200, 384, ("avif", "webp")),
    ("barco-cenital.webp", "fallback/etapa-06", None, 1200, 384, ("avif", "webp")),
    ("reunion-acuerdo.webp", "fallback/etapa-02", None, 1200, 384, ("avif", "webp")),
    # texturas para los carteles del showroom (16:9)
    ("apreton-manos.webp", "carteles/cartel-01", (0, 40, 512, 328), 512, 384, ("webp",)),
    ("reunion-acuerdo.webp", "carteles/cartel-02", (0, 100, 512, 388), 512, 384, ("webp",)),
]
QUALITY = {"avif": 52, "webp": 78}


def clean(im):
    """Copia sin metadatos, en RGB."""
    out = Image.new("RGB", im.size)
    out.paste(im.convert("RGB"))
    return out


def save(im, dest, fmt):
    dest.parent.mkdir(parents=True, exist_ok=True)
    kw = {"quality": QUALITY[fmt]}
    if fmt == "webp":
        kw["method"] = 6
    if fmt == "avif":
        kw["speed"] = 4
    im.save(dest, fmt.upper(), **kw)
    return dest.stat().st_size


def resized(im, width):
    if im.width <= width:
        return im
    h = round(im.height * width / im.width)
    return im.resize((width, h), Image.LANCZOS)


report = []
for src, dest, crop, wd, wm, fmts in JOBS:
    im = clean(Image.open(SRC / src))
    if crop:
        im = im.crop(crop)
    for tag, w in (("desktop", wd), ("mobile", wm)):
        v = resized(im, w)
        for fmt in fmts:
            p = OUT / f"{dest}-{tag}.{fmt}"
            size = save(v, p, fmt)
            report.append((p.relative_to(OUT).as_posix(), v.size, size))

# imagen para compartir en redes (1200×630, JPG para máxima compatibilidad)
og = clean(Image.open(SRC / "barco-atardecer.webp"))
og = og.resize((1200, round(og.height * 1200 / og.width)), Image.LANCZOS)
top = (og.height - 630) // 2
og = og.crop((0, top, 1200, top + 630))
p = OUT / "og" / "og-laksmi.jpg"
p.parent.mkdir(parents=True, exist_ok=True)
og.save(p, "JPEG", quality=82, optimize=True, progressive=True)
report.append((p.relative_to(OUT).as_posix(), og.size, p.stat().st_size))

total = 0
for path, size, b in report:
    total += b
    print(f"{path:42} {size[0]:>5}×{size[1]:<5} {b / 1024:7.1f} KB")
print(f"{'total':42} {'':11} {total / 1024:7.1f} KB")
