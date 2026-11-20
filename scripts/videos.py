"""Recodifica los clips de assets-fuente/videos/ para el modo video (npm run videos).

Agregar un clip nuevo: dejarlo en assets-fuente/videos/, sumarlo a "videos.clips" en src/content/es.json
(y a la etapa con {"clip": "<id>"}) y correr npm run videos. No hace falta tocar código.

  npm run videos                      → todos los clips
  npm run videos -- plan feria        → solo esos
  npm run videos -- --escalar         → desktop a 1080p con Real-ESRGAN (ver abajo)

Por cada clip:
- Sin audio, a 24 fps. Tramo opcional ("desde", "duracion").
- Desktop: 1280×720 (o 1920×1080 si el origen ya es 1080p o se escaló), con un enfoque leve (unsharp).
- Mobile: 540×960. Si existe la versión vertical ("vertical" en es.json) se usa esa (720×1280 si tiene la
  resolución); si no, se recorta la horizontal a 9:16 siguiendo "focalMobile" (fijo o con puntos en el tiempo).
- AV1 (MP4, primera opción) y H.264 (MP4, respaldo). Keyframe cada ½ s; si no entra en el presupuesto
  (es.json → videos.presupuestoKB) sin bajar del piso de calidad (SSIM), se espacian a 1 s y 2 s; si aun así
  no entra, deja la versión de calidad aceptable y avisa cuánto pesa.
- Póster (AVIF + WebP en public/assets/fotos/video-<id>-*): si el clip tiene "foto" y arranca en el segundo 0,
  es la foto original alineada con el primer cuadro (nítida); si no, el primer cuadro.

--escalar: Real-ESRGAN (realesrgan-ncnn-vulkan, modelo realesrgan-x4plus para fotografía real) en la GPU por
Vulkan; cada cuadro se escala ×4 y se reduce a 1920×1080. Se saltea si el origen ya es 1080p o si el clip
tiene "escalar": false (p. ej., si las caras quedan "plásticas"). Los cuadros quedan en .cache/escalado/<id>/
y se retoma donde quedó. Ejecutable: .cache/realesrgan/ o la variable REALESRGAN.
Necesita ffmpeg (libx264, libsvtav1) y Pillow con AVIF.
"""
import json
import os
import re
import shutil
import subprocess
import sys
import time
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).parent))
from alinear import alinear  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
CONTENT = json.loads((ROOT / "src" / "content" / "es.json").read_text(encoding="utf8"))
V = CONTENT["videos"]
SRC = ROOT / "assets-fuente" / "videos"
FOTOS_SRC = ROOT / "assets-fuente"
OUT = ROOT / "public" / V["base"].strip("/")
FOTOS = ROOT / "public" / CONTENT["imagenes"]["base"].strip("/")
CACHE = ROOT / ".cache" / "videos"
ESC = ROOT / ".cache" / "escalado"
ESRGAN = Path(os.environ.get("REALESRGAN", ROOT / ".cache" / "realesrgan" / "realesrgan-ncnn-vulkan.exe"))
FPS = 24
GOPS = (0.5, 1.0, 2.0)
SSIM_MIN = 0.95
UNSHARP = "unsharp=5:5:0.35:5:5:0"  # enfoque leve (solo luminancia) para 720p
UNSHARP_HD = "unsharp=5:5:0.6:5:5:0"  # al pasar de 720p a 1080p con lanczos, un poco más
CRF_HD_MAX = 36  # si a 1080p hace falta más compresión que esto para entrar, queda en 720p
args = [a for a in sys.argv[1:] if not a.startswith("--")]
ESCALAR = "--escalar" in sys.argv
SOLO = set(args)
for d in (OUT, CACHE, ESC):
    d.mkdir(parents=True, exist_ok=True)


def run(cmd):
    return subprocess.run(cmd, check=True, capture_output=True, text=True, encoding="utf8", errors="replace")


def probe(path):
    d = json.loads(run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height:format=duration", "-of", "json", str(path)]).stdout)
    return d["streams"][0]["width"], d["streams"][0]["height"], float(d["format"]["duration"])


def pct(s):
    return [float(v.strip().rstrip("%")) / 100 for v in s.split()]


def focal_x(focal, t):
    if isinstance(focal, str):
        return pct(focal)[0]
    pts = [(float(a), pct(f)[0]) for a, f in focal]
    if t <= pts[0][0]:
        return pts[0][1]
    for (ta, xa), (tb, xb) in zip(pts, pts[1:]):
        if t <= tb:
            return xa + (xb - xa) * (t - ta) / (tb - ta)
    return pts[-1][1]


def focal_expr(focal, t0):
    """Expresión de ffmpeg para el centro x del recorte, lineal entre puntos en el tiempo."""
    if isinstance(focal, str):
        return f"{pct(focal)[0]:.4f}"
    pts = [(float(t) - t0, pct(f)[0]) for t, f in focal]
    expr = f"{pts[-1][1]:.4f}"
    for (ta, xa), (tb, xb) in reversed(list(zip(pts, pts[1:]))):
        expr = f"if(lt(t,{tb:.3f}),{xa:.4f}+({xb - xa:.4f})*clip((t-({ta:.3f}))/{tb - ta:.3f},0,1),{expr})"
    return expr


def cut(clip):
    t0 = float(clip.get("desde", 0))
    d = clip.get("duracion")
    return ["-ss", f"{t0}"] + (["-t", f"{d}"] if d else [])


# ---------- escalado con Real-ESRGAN ----------
def escalar(clip):
    """Devuelve la carpeta con los cuadros 1080p escalados (o None si no corresponde)."""
    src = SRC / clip["archivo"]
    w, h, _ = probe(src)
    if h >= 1080 or clip.get("escalar") is False:
        return None
    if not ESRGAN.exists():
        print(f"  [{clip['id']}] --escalar: no encuentro realesrgan-ncnn-vulkan ({ESRGAN}); queda en 720p")
        return None
    base = ESC / clip["id"]
    ins, outs, pend = base / "in", base / "x4", base / "pendientes"
    for d in (ins, outs):
        d.mkdir(parents=True, exist_ok=True)
    if not any(ins.iterdir()):
        run(["ffmpeg", "-y", "-v", "error", *cut(clip), "-i", str(src), "-vf", f"fps={FPS}", str(ins / "%04d.png")])
    frames = sorted(ins.glob("*.png"))
    todo = [f for f in frames if not (outs / f.name).exists()]
    if todo:
        shutil.rmtree(pend, ignore_errors=True)
        pend.mkdir()
        for f in todo:
            shutil.copy(f, pend / f.name)
        t = time.time()
        print(f"  [{clip['id']}] Real-ESRGAN: {len(todo)} de {len(frames)} cuadros…", flush=True)
        subprocess.run([str(ESRGAN), "-i", str(pend), "-o", str(outs), "-n", "realesrgan-x4plus", "-s", "4", "-f", "png"], check=True, capture_output=True)
        print(f"  [{clip['id']}] listo en {(time.time() - t) / 60:.1f} min ({(time.time() - t) / len(todo):.0f} s por cuadro)", flush=True)
        shutil.rmtree(pend, ignore_errors=True)
    return outs


def chains(clip, hd=True):
    """Por vista: (argumentos de entrada, filtros, tamaño). hd: desktop a 1080p (lanczos + enfoque)."""
    src = SRC / clip["archivo"]
    t0 = float(clip.get("desde", 0))
    w, h, _ = probe(src)
    up = escalar(clip) if ESCALAR else None
    if up:
        desk = (["-framerate", str(FPS), "-i", str(up / "%04d.png")], f"scale=1920:1080:flags=lanczos,{UNSHARP},setsar=1", (1920, 1080))
    else:
        if h >= 1080 or (hd and clip.get("desktop1080") is not False):
            desk = ([*cut(clip), "-i", str(src)], f"fps={FPS},scale=1920:1080:flags=lanczos,{UNSHARP if h >= 1080 else UNSHARP_HD},setsar=1", (1920, 1080))
        else:
            desk = ([*cut(clip), "-i", str(src)], f"fps={FPS},scale=1280:720:flags=lanczos,{UNSHARP},setsar=1", (1280, 720))
    vert = SRC / clip["vertical"] if clip.get("vertical") else None
    if vert and vert.exists():
        vw, vh, _ = probe(vert)
        size = (720, 1280) if vh >= 1280 else (540, 960)
        fx, fy = pct(clip.get("focalVertical", "50% 50%"))
        # el vertical tiene su propio tramo ("desdeVertical", "duracionVertical"); por defecto, completo
        cv = ["-ss", str(clip.get("desdeVertical", 0))] + (["-t", str(clip["duracionVertical"])] if clip.get("duracionVertical") else [])
        mob = ([*cv, "-i", str(vert)], f"fps={FPS},crop=w='min(iw,ih*9/16)':h='min(ih,iw*16/9)':x='clip({fx}*iw-ow/2,0,iw-ow)':y='clip({fy}*ih-oh/2,0,ih-oh)',scale={size[0]}:{size[1]}:flags=lanczos,setsar=1", size)
    else:
        x = focal_expr(clip.get("focalMobile", "50% 50%"), t0)
        mob = ([*cut(clip), "-i", str(src)], f"fps={FPS},crop=w=ih*9/16:h=ih:x='clip(({x})*iw-ow/2,0,iw-ow)':y=0,scale=540:960:flags=lanczos,setsar=1", (540, 960))
    return {"desktop": desk, "mobile": mob}


# ---------- codificación ----------
def encode(inp, vf, dest, codec, gop_s, crf=None, kbps=None):
    gop = max(2, round(FPS * gop_s))
    base = ["ffmpeg", "-y", "-v", "error", *inp, "-an", "-vf", vf, "-r", str(FPS), "-g", str(gop), "-keyint_min", str(gop), "-pix_fmt", "yuv420p"]
    if codec == "h264":
        enc = ["-c:v", "libx264", "-preset", "slow", "-sc_threshold", "0", "-profile:v", "high"]
        tail = ["-movflags", "+faststart", str(dest)]
        if crf is not None:
            run(base + enc + ["-crf", str(crf)] + tail)
        else:
            log = str(CACHE / "2pass")
            run(base + enc + ["-b:v", f"{kbps}k", "-pass", "1", "-passlogfile", log, "-f", "null", "NUL"])
            run(base + enc + ["-b:v", f"{kbps}k", "-pass", "2", "-passlogfile", log] + tail)
    else:  # AV1 (SVT-AV1), calidad constante
        run(base + ["-c:v", "libsvtav1", "-preset", "5", "-crf", str(crf), "-svtav1-params", f"tune=0:keyint={gop}:scd=0", "-movflags", "+faststart", str(dest)])
    return dest.stat().st_size


def ssim(inp, vf, dest):
    r = subprocess.run(["ffmpeg", "-v", "info", "-i", str(dest), *inp, "-filter_complex", f"[1:v]{vf}[ref];[0:v][ref]ssim", "-f", "null", "NUL"], capture_output=True, text=True, encoding="utf8", errors="replace")
    m = re.search(r"All:([0-9.]+)", r.stderr)
    return float(m.group(1)) if m else 0.0


def best_h264(inp, vf, dest, budget, dur):
    size = encode(inp, vf, dest, "h264", 0.5, crf=21)
    if size <= budget:
        return dict(gop=0.5, modo="crf 21", size=size, ssim=ssim(inp, vf, dest), ok=True)
    kbps = int(budget * 8 / 1000 / dur * 0.95)
    last = None
    for gop in GOPS:
        size = encode(inp, vf, dest, "h264", gop, kbps=kbps)
        q = ssim(inp, vf, dest)
        last = dict(gop=gop, modo=f"{kbps} kbps", size=size, ssim=q, ok=size <= budget * 1.02 and q >= SSIM_MIN)
        if last["ok"]:
            return last
    return last


def best_av1(inp, vf, dest, budget, gops=GOPS):
    """La mejor calidad (CRF más bajo, desde 24) que entra en el presupuesto, espaciando keyframes si hace falta."""
    last = None
    for gop in gops:
        lo, hi, fit, last_crf = 24, 52, None, 24
        if encode(inp, vf, dest, "av1", gop, crf=lo) <= budget:
            fit = lo
        else:
            while hi - lo > 2:  # búsqueda binaria de CRF
                mid = last_crf = (lo + hi) // 2
                if encode(inp, vf, dest, "av1", gop, crf=mid) <= budget:
                    hi, fit = mid, mid
                else:
                    lo = mid
            fit = fit or hi
            if last_crf != fit:
                encode(inp, vf, dest, "av1", gop, crf=fit)
        q = ssim(inp, vf, dest)
        last = dict(gop=gop, modo=f"crf {fit}", crf=fit, size=dest.stat().st_size, ssim=q, ok=dest.stat().st_size <= budget and q >= SSIM_MIN)
        if last["ok"]:
            return last
    return last


# ---------- pósters ----------
def save_img(im, name, kb):
    for fmt, q0 in (("avif", 62), ("webp", 82)):
        dest = FOTOS / f"{name}.{fmt}"
        q = q0
        while True:
            im.save(dest, fmt.upper(), quality=q, **({"method": 6} if fmt == "webp" else {"speed": 4}))
            if dest.stat().st_size <= kb * 1024 or q <= 30:
                break
            q -= 4


def posters(clip):
    t0 = float(clip.get("desde", 0))
    png = CACHE / f"{clip['id']}-f0.png"
    run(["ffmpeg", "-y", "-v", "error", *cut(clip), "-i", str(SRC / clip["archivo"]), "-frames:v", "1", str(png)])
    f0 = Image.open(png).convert("RGB")
    if clip.get("foto") and t0 == 0 and (FOTOS_SRC / f"{clip['foto']}.jpg").exists():
        # foto original alineada con el primer cuadro: el póster (y la imagen en reposo) es nítido
        foto = Image.open(FOTOS_SRC / f"{clip['foto']}.jpg").convert("RGB")
        box, _ = alinear(foto, f0)
        desk = foto.crop(box).resize((1920, 1080), Image.LANCZOS)
        x0, y0, x1, y1 = box
        w = (y1 - y0) * 9 / 16
        cx = x0 + focal_x(clip.get("focalMobile", "50% 50%"), t0) * (x1 - x0)
        cx = min(max(cx, x0 + w / 2), x1 - w / 2)
        mob = foto.crop((cx - w / 2, y0, cx + w / 2, y1)).resize((720, 1280), Image.LANCZOS)
        origen = "foto"
    else:
        desk = f0
        src, vf, _ = chains_mobile_only(clip)
        mpng = CACHE / f"{clip['id']}-f0m.png"
        run(["ffmpeg", "-y", "-v", "error", *src, "-vf", vf, "-frames:v", "1", str(mpng)])
        mob = Image.open(mpng).convert("RGB")
        origen = "primer cuadro"
    vert = SRC / clip["vertical"] if clip.get("vertical") else None
    if vert and vert.exists():
        # con versión vertical, el póster de mobile sale de ella (si no, saltaría al pasar al video):
        # la foto vertical original alineada (<foto>-vertical.jpg) si existe, o su primer cuadro
        src, vf, _ = chains_mobile_only(clip)
        mpng = CACHE / f"{clip['id']}-f0v.png"
        run(["ffmpeg", "-y", "-v", "error", *src, "-vf", vf, "-frames:v", "1", str(mpng)])
        mob = Image.open(mpng).convert("RGB")
        vfoto = FOTOS_SRC / f"{clip.get('foto')}-vertical.jpg"
        if clip.get("foto") and not clip.get("desdeVertical") and vfoto.exists():
            fv = Image.open(vfoto).convert("RGB")
            box, _ = alinear(fv, mob)
            mob = fv.crop(box).resize(mob.size, Image.LANCZOS)
    save_img(desk, f"video-{clip['id']}-desktop", 250)
    save_img(mob, f"video-{clip['id']}-mobile", 120)
    return origen


def chains_mobile_only(clip):
    global ESCALAR
    keep, ESCALAR = ESCALAR, False
    try:
        return chains(clip)["mobile"]
    finally:
        ESCALAR = keep


if __name__ == "__main__":
    report = {}
    for clip in V["clips"]:
        if SOLO and clip["id"] not in SOLO:
            continue
        if not (SRC / clip["archivo"]).exists():
            print(f"falta {clip['archivo']} en assets-fuente/videos/ — se omite")
            continue
        origen = posters(clip)
        ch = chains(clip)
        for view in ("desktop", "mobile"):
            inp, vf, size = ch[view]
            budget = V["presupuestoKB"][view] * 1024
            dur = float(clip.get("duracion") or probe(SRC / clip["archivo"])[2] - float(clip.get("desde", 0)))
            first = None
            if view == "desktop" and size == (1920, 1080) and probe(SRC / clip["archivo"])[1] < 1080 and not (ESCALAR and ESC.joinpath(clip["id"], "x4").exists()):
                # 720p → 1080p con lanczos y enfoque: solo si entra con buena calidad; si no, 720p
                first = best_av1(inp, vf, OUT / f"{clip['id']}-{view}.av1.mp4", budget, gops=(0.5,))
                if not first["ok"] or first["crf"] > CRF_HD_MAX:
                    print(f"  [{clip['id']}] 1080p necesita crf {first['crf']} para entrar: queda en 720p", flush=True)
                    inp, vf, size = chains(clip, hd=False)["desktop"]
                    first = None
            for codec, ext in (("av1", "av1.mp4"), ("h264", "mp4")):
                dest = OUT / f"{clip['id']}-{view}.{ext}"
                if codec == "av1" and first:
                    r = first
                else:
                    r = best_av1(inp, vf, dest, budget) if codec == "av1" else best_h264(inp, vf, dest, budget, dur)
                r.update(res=f"{size[0]}×{size[1]}", poster=origen)
                report[dest.name] = r
                print(f"{dest.name:28} {size[0]}×{size[1]}  {r['size'] / 1024:7.1f} KB  ssim {r['ssim']:.3f}  keyframe {r['gop']} s  {r['modo']:10} {'ok' if r['ok'] else 'EXCEDE el presupuesto o la calidad'}", flush=True)
    prev = CACHE / "reporte.json"
    old = json.loads(prev.read_text(encoding="utf8")) if prev.exists() else {}
    old = {k: v for k, v in old.items() if k.endswith(".mp4")}
    old.update(report)
    prev.write_text(json.dumps(old, indent=2), encoding="utf8")
