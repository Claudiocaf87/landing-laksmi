"""Recodifica los clips de assets-fuente/videos/ para el modo video (npm run videos).

Agregar un clip nuevo: dejarlo en assets-fuente/videos/, sumarlo a "videos.clips" en src/content/es.json
(y a la etapa con {"clip": "<id>"}) y correr npm run videos. No hace falta tocar código.

Por cada clip:
- Sin audio, a 24 fps. Recorte opcional en el tiempo ("desde", "duracion").
- Desktop 1280×720. Mobile 540×960: si existe la versión vertical ("vertical" en es.json) se usa esa
  (720×1280 si tiene la resolución); si no, se recorta la horizontal a 9:16 siguiendo "focalMobile",
  un punto focal fijo ("48% 50%") o que se mueve en el tiempo ([[0, "57% 50%"], [4, "49% 50%"]]).
- MP4 (H.264, +faststart) y WebM (VP9).
- Presupuesto (es.json → videos.presupuestoKB): primero prueba con buena calidad y keyframes cada ½ s.
  Si no entra, codifica en dos pasadas apuntando al presupuesto y va espaciando los keyframes
  (½ s → 1 s → 2 s) hasta que la calidad (SSIM contra el original) supere el piso.
  Si ni así entra sin perder calidad visible, deja la versión de calidad aceptable y avisa cuánto pesa.
- Póster: el primer cuadro (desktop y mobile) en AVIF + WebP en public/assets/fotos/video-<id>-*.
Necesita ffmpeg (libx264, libvpx-vp9) y Pillow con AVIF.
"""
import json
import re
import subprocess
import sys
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
CONTENT = json.loads((ROOT / "src" / "content" / "es.json").read_text(encoding="utf8"))
V = CONTENT["videos"]
SRC = ROOT / "assets-fuente" / "videos"
OUT = ROOT / "public" / V["base"].strip("/").removeprefix("public/")
FOTOS = ROOT / "public" / CONTENT["imagenes"]["base"].strip("/")
CACHE = ROOT / ".cache" / "videos"
OUT.mkdir(parents=True, exist_ok=True)
CACHE.mkdir(parents=True, exist_ok=True)
FPS = 24
GOPS = (0.5, 1.0, 2.0)  # segundos entre keyframes: más corto = buscar un cuadro es más rápido
SSIM_MIN = 0.95  # por debajo se empiezan a notar bloques y texturas lavadas
SOLO = set(sys.argv[1:])  # npm run videos -- feria transito → solo esos


def run(args):
    return subprocess.run(args, check=True, capture_output=True, text=True, encoding="utf8", errors="replace")


def probe(path):
    out = run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height:format=duration", "-of", "json", str(path)]).stdout
    d = json.loads(out)
    return d["streams"][0]["width"], d["streams"][0]["height"], float(d["format"]["duration"])


def pct(s):
    return [float(v.strip().rstrip("%")) / 100 for v in s.split()]


def focal_expr(focal, t0):
    """Expresión de ffmpeg para el centro x del recorte (fracción del ancho), lineal entre puntos en el tiempo."""
    if isinstance(focal, str):
        return f"{pct(focal)[0]:.4f}"
    pts = [(float(t) - t0, pct(f)[0]) for t, f in focal]
    expr = f"{pts[-1][1]:.4f}"
    for (ta, xa), (tb, xb) in reversed(list(zip(pts, pts[1:]))):
        expr = f"if(lt(t,{tb:.3f}),{xa:.4f}+({xb - xa:.4f})*clip((t-({ta:.3f}))/{tb - ta:.3f},0,1),{expr})"
    return expr


def chains(clip):
    """Filtros de video (desktop, mobile) y la fuente de cada uno."""
    src = SRC / clip["archivo"]
    t0 = float(clip.get("desde", 0))
    desk = (src, f"fps={FPS},scale=1280:720:flags=lanczos,setsar=1", (1280, 720))
    vert = SRC / clip["vertical"] if clip.get("vertical") else None
    if vert and vert.exists():
        w, h, _ = probe(vert)
        size = (720, 1280) if h >= 1280 else (540, 960)
        fx, fy = pct(clip.get("focalVertical", "50% 50%"))
        mob = (vert, f"fps={FPS},crop=w='min(iw,ih*9/16)':h='min(ih,iw*16/9)':x='clip({fx}*iw-ow/2,0,iw-ow)':y='clip({fy}*ih-oh/2,0,ih-oh)',scale={size[0]}:{size[1]}:flags=lanczos,setsar=1", size)
    else:
        x = focal_expr(clip.get("focalMobile", "50% 50%"), t0)
        mob = (src, f"fps={FPS},crop=w=ih*9/16:h=ih:x='clip(({x})*iw-ow/2,0,iw-ow)':y=0,scale=540:960:flags=lanczos,setsar=1", (540, 960))
    return {"desktop": desk, "mobile": mob}


def cut(clip):
    t0 = float(clip.get("desde", 0))
    d = clip.get("duracion")
    return ["-ss", f"{t0}"] + (["-t", f"{d}"] if d else [])


def encode(clip, src, vf, dest, codec, gop_s, crf=None, kbps=None):
    gop = max(2, round(FPS * gop_s))
    base = ["ffmpeg", "-y", "-v", "error", *cut(clip), "-i", str(src), "-an", "-vf", vf, "-r", str(FPS), "-g", str(gop), "-keyint_min", str(gop)]
    log = str(CACHE / "2pass")
    if codec == "mp4":
        enc = ["-c:v", "libx264", "-preset", "slow", "-sc_threshold", "0", "-pix_fmt", "yuv420p", "-profile:v", "high"]
        tail = ["-movflags", "+faststart", str(dest)]
        if crf is not None:
            run(base + enc + ["-crf", str(crf)] + tail)
        else:
            run(base + enc + ["-b:v", f"{kbps}k", "-pass", "1", "-passlogfile", log, "-f", "null", "NUL"])
            run(base + enc + ["-b:v", f"{kbps}k", "-pass", "2", "-passlogfile", log] + tail)
    else:
        enc = ["-c:v", "libvpx-vp9", "-row-mt", "1", "-deadline", "good", "-pix_fmt", "yuv420p"]
        if crf is not None:
            run(base + enc + ["-crf", str(crf), "-b:v", "0", "-cpu-used", "2", str(dest)])
        else:
            run(base + enc + ["-b:v", f"{kbps}k", "-pass", "1", "-passlogfile", log, "-cpu-used", "4", "-f", "null", "NUL"])
            run(base + enc + ["-b:v", f"{kbps}k", "-pass", "2", "-passlogfile", log, "-cpu-used", "2", str(dest)])
    return dest.stat().st_size


def ssim(clip, src, vf, dest):
    r = subprocess.run(
        ["ffmpeg", "-v", "info", "-i", str(dest), *cut(clip), "-i", str(src), "-filter_complex", f"[1:v]{vf}[ref];[0:v][ref]ssim", "-f", "null", "NUL"],
        capture_output=True, text=True, encoding="utf8", errors="replace",
    )
    m = re.search(r"All:([0-9.]+)", r.stderr)
    return float(m.group(1)) if m else 0.0


def best(clip, view, codec, dest):
    src, vf, _ = chains(clip)[view]
    budget = V["presupuestoKB"][view] * 1024
    dur = float(clip.get("duracion") or probe(src)[2] - float(clip.get("desde", 0)))
    # 1) buena calidad con keyframes cada ½ s: si entra, listo
    crf = 23 if codec == "mp4" else 33
    size = encode(clip, src, vf, dest, codec, 0.5, crf=crf)
    if size <= budget:
        return dict(gop=0.5, modo=f"crf {crf}", size=size, ssim=ssim(clip, src, vf, dest), ok=True)
    # 2) dos pasadas al presupuesto, espaciando keyframes hasta que la calidad alcance
    kbps = int(budget * 8 / 1000 / dur * 0.94)
    last = None
    for gop in GOPS:
        size = encode(clip, src, vf, dest, codec, gop, kbps=kbps)
        q = ssim(clip, src, vf, dest)
        last = dict(gop=gop, modo=f"{kbps} kbps", size=size, ssim=q, ok=size <= budget * 1.02 and q >= SSIM_MIN)
        if last["ok"]:
            return last
    # 3) no entra sin perder calidad: versión al piso de calidad (keyframes cada 2 s), aunque se pase
    for crf in (range(26, 37, 2) if codec == "mp4" else range(36, 52, 3)):
        size = encode(clip, src, vf, dest, codec, 2.0, crf=crf)
        q = ssim(clip, src, vf, dest)
        if q < SSIM_MIN:
            break
        last = dict(gop=2.0, modo=f"crf {crf}", size=size, ssim=q, ok=size <= budget)
        good = dest.with_suffix(".ok" + dest.suffix)
        dest.replace(good)
    good = dest.with_suffix(".ok" + dest.suffix)
    if good.exists():
        good.replace(dest)
    else:
        encode(clip, src, vf, dest, codec, 2.0, kbps=kbps)
    return last


def poster(clip, view):
    src, vf, size = chains(clip)[view]
    png = CACHE / f"{clip['id']}-{view}.png"
    run(["ffmpeg", "-y", "-v", "error", *cut(clip), "-i", str(src), "-vf", vf, "-frames:v", "1", str(png)])
    im = Image.open(png).convert("RGB")
    kb = 250 if view == "desktop" else 120
    for fmt, q0 in (("avif", 60), ("webp", 80)):
        dest = FOTOS / f"video-{clip['id']}-{view}.{fmt}"
        q = q0
        while True:
            im.save(dest, fmt.upper(), quality=q, **({"method": 6} if fmt == "webp" else {"speed": 4}))
            if dest.stat().st_size <= kb * 1024 or q <= 30:
                break
            q -= 5


report = []
for clip in V["clips"]:
    if SOLO and clip["id"] not in SOLO:
        continue
    if not (SRC / clip["archivo"]).exists():
        print(f"falta {clip['archivo']} en assets-fuente/videos/ — se omite")
        continue
    for view in ("desktop", "mobile"):
        poster(clip, view)
        for codec in ("mp4", "webm"):
            dest = OUT / f"{clip['id']}-{view}.{codec}"
            r = best(clip, view, codec, dest)
            report.append((dest.name, r))
            print(f"{dest.name:28} {r['size'] / 1024:7.1f} KB  ssim {r['ssim']:.3f}  keyframe {r['gop']} s  {r['modo']:10} {'ok' if r['ok'] else 'EXCEDE el presupuesto'}", flush=True)

(CACHE / "reporte.json").write_text(json.dumps({n: r for n, r in report}, indent=2), encoding="utf8")
