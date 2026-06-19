"""Generate placeholder app icons for the Scaffold Tauri app.

Produces the icon files referenced by tauri.conf.json:
  - 32x32.png, 128x128.png, 128x128@2x.png (256x256)
  - icon.ico (multi-size Windows icon)
  - icon.icns (macOS icon set)

The mark is a simple "S" glyph on a rounded indigo tile. Replace with real
branding before release.
"""
import struct
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ICON_DIR = Path(__file__).resolve().parent.parent / "src-tauri" / "icons"
ICON_DIR.mkdir(exist_ok=True)

BG = (99, 102, 241, 255)   # indigo-500
BG_DARK = (67, 56, 202, 255)  # indigo-700 (gradient bottom)
FG = (255, 255, 255, 255)


def render(size: int) -> Image.Image:
    """Render the Scaffold mark at the given square size with 4x supersampling."""
    s = size * 4
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # Rounded tile background with a simple vertical gradient.
    radius = int(s * 0.22)
    tile = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    td = ImageDraw.Draw(tile)
    td.rounded_rectangle((0, 0, s - 1, s - 1), radius=radius, fill=BG)
    grad = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    gd = ImageDraw.Draw(grad)
    for y in range(s):
        t = y / (s - 1)
        r = int(BG[0] * (1 - t) + BG_DARK[0] * t)
        g = int(BG[1] * (1 - t) + BG_DARK[1] * t)
        b = int(BG[2] * (1 - t) + BG_DARK[2] * t)
        gd.line((0, y, s, y), fill=(r, g, b, 255))
    mask = Image.new("L", (s, s), 0)
    md = ImageDraw.Draw(mask)
    md.rounded_rectangle((0, 0, s - 1, s - 1), radius=radius, fill=255)
    tile = Image.composite(grad, tile, mask)
    img.alpha_composite(tile)
    # "S" glyph.
    try:
        font = ImageFont.truetype(
            "/System/Library/Fonts/SFNSDisplay.ttf", int(s * 0.62)
        )
    except OSError:
        font = ImageFont.load_default()
    td2 = ImageDraw.Draw(img)
    text = "S"
    bbox = td2.textbbox((0, 0), text, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    tx = (s - tw) / 2 - bbox[0]
    ty = (s - th) / 2 - bbox[1] - int(s * 0.02)
    td2.text((tx, ty), text, font=font, fill=FG)
    return img.resize((size, size), Image.LANCZOS)


def write_pngs():
    sizes = {"32x32.png": 32, "128x128.png": 128, "128x128@2x.png": 256}
    for name, size in sizes.items():
        render(size).save(ICON_DIR / name)


def write_ico():
    # Multi-size .ico: 16,32,48,64,128,256
    sizes = [16, 32, 48, 64, 128, 256]
    images = [render(s) for s in sizes]
    images[0].save(
        ICON_DIR / "icon.ico",
        format="ICO",
        sizes=[(s, s) for s in sizes],
        append_images=images[1:],
    )


def write_icns():
    """Minimal hand-rolled .icns using PNG-based icon types.

    We embed a few standard PNG sizes with their 4-char type codes. macOS and
    Tauri's bundler accept this; for production you'd regenerate via iconutil.
    """
    # type code -> pixel size
    entries = [
        (b"ic08", 256),
        (b"ic12", 32),
        (b"ic13", 128),
        (b"ic07", 512),
    ]
    blobs = []
    for code, size in entries:
        data = _png_to_bytes(render(size))
        # Each icns element: [4-byte type][4-byte big-endian length][data]
        elem_len = 8 + len(data)
        blobs.append(code + struct.pack(">I", elem_len) + data)
    body = b"".join(blobs)
    header = b"icns" + struct.pack(">I", 4 + len(body))
    (ICON_DIR / "icon.icns").write_bytes(header + body)


def _png_to_bytes(img: Image.Image) -> bytes:
    import io

    bio = io.BytesIO()
    img.save(bio, format="PNG")
    return bio.getvalue()


if __name__ == "__main__":
    write_pngs()
    write_ico()
    write_icns()
    print("icons written to", ICON_DIR)
