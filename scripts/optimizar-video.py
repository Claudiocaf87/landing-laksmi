"""Recodifica los videos de assets-fuente/ para scrubbing (avance atado al scroll).

Uso: python scripts/optimizar-video.py   (necesita ffmpeg en el PATH, con libx264 y libvpx-vp9)
- Sin audio. MP4 (H.264, +faststart) y WebM (VP9).
- Keyframes frecuentes (GOP corto) para que buscar un cuadro, hacia adelante o hacia atrás, sea rápido.
- Dos cadencias: 24 fps (original) y 12 fps (menos cuadros, menos peso).
- Ajusta la calidad (CRF) hasta entrar en el presupuesto: ≤ 2,5 MB desktop, ≤ 1,5 MB mobile.
"""
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "assets-fuente"
OUT = ROOT / "public" / "assets" / "video"
OUT.mkdir(parents=True, exist_ok=True)

JOBS = [  # (origen, destino, presupuesto en KB)
    ("puerto-video.mp4", "puerto-desktop", 2500),
    ("puerto-video-vertical.mp4", "puerto-mobile", 1500),
]
FPS = (24, 12)
GOP_S = 0.5  # ½ s entre keyframes: buscar un cuadro decodifica a lo sumo 11 cuadros (24 fps)


def encode(src, dest, fps, codec, crf):
    gop = max(2, round(fps * GOP_S))  # keyframe cada GOP_S segundos
    common = ["ffmpeg", "-y", "-v", "error", "-i", str(src), "-an", "-r", str(fps), "-g", str(gop), "-keyint_min", str(gop)]
    if codec == "mp4":
        args = common + ["-c:v", "libx264", "-preset", "slow", "-crf", str(crf), "-sc_threshold", "0", "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(dest)]
    else:
        args = common + ["-c:v", "libvpx-vp9", "-crf", str(crf), "-b:v", "0", "-row-mt", "1", "-deadline", "good", "-cpu-used", "2", str(dest)]
    subprocess.run(args, check=True)
    return dest.stat().st_size


report = []
for src, name, kb in JOBS:
    for fps in FPS:
        for codec, crf0, step, crf_max in (("mp4", 24, 2, 34), ("webm", 34, 3, 46)):
            dest = OUT / f"{name}-{fps}fps.{codec}"
            crf = crf0
            while True:
                size = encode(SRC / src, dest, fps, codec, crf)
                if size <= kb * 1024 or crf >= crf_max:
                    break
                crf += step
            report.append((dest.name, fps, codec, crf, size, size <= kb * 1024))

for name, fps, codec, crf, size, ok in report:
    print(f"{name:32} {fps:>2} fps  {codec:4}  crf {crf:>2}  {size / 1024:7.1f} KB  {'ok' if ok else 'EXCEDE'}")
