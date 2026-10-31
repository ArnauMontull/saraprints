"""Genera los iconos de la PWA en public/iconos/ (impresora con una tira saliendo).

Uso: C:\\LIFE_OS\\.venv\\Scripts\\python.exe scripts\\iconos.py
"""
from pathlib import Path

from PIL import Image, ImageDraw

SALIDA = Path(__file__).resolve().parent.parent / "public" / "iconos"
TEAL = (13, 148, 136)
PIZARRA = (30, 41, 59)
BLANCO = (255, 255, 255)
GRIS = (148, 163, 184)


def dibujar(lado: int) -> Image.Image:
    # Se dibuja a 4× y se reduce para que los bordes salgan suaves
    k = 4
    n = lado * k
    img = Image.new("RGB", (n, n), TEAL)
    d = ImageDraw.Draw(img)
    u = n / 100  # unidades de 1 % del lado; el contenido queda dentro del 80 % central (zona segura «maskable»)
    # Tira de papel
    d.rectangle([34 * u, 18 * u, 66 * u, 58 * u], fill=BLANCO)
    for i, y in enumerate((25, 32, 39, 46)):
        d.rounded_rectangle([39 * u, y * u, (61 if i % 2 == 0 else 54) * u, (y + 3) * u], radius=1.5 * u, fill=PIZARRA)
    # Cuerpo de la impresora
    d.rounded_rectangle([20 * u, 54 * u, 80 * u, 82 * u], radius=9 * u, fill=PIZARRA)
    d.rounded_rectangle([30 * u, 56 * u, 70 * u, 60 * u], radius=2 * u, fill=GRIS)
    d.ellipse([66 * u, 68 * u, 72 * u, 74 * u], fill=TEAL)
    return img.resize((lado, lado), Image.LANCZOS)


def main() -> None:
    SALIDA.mkdir(parents=True, exist_ok=True)
    for nombre, lado in (("icono-192.png", 192), ("icono-512.png", 512), ("apple-touch-icon.png", 180)):
        dibujar(lado).save(SALIDA / nombre, optimize=True)
        print(SALIDA / nombre)


if __name__ == "__main__":
    main()
