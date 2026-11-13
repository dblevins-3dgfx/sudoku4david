"""Render the digits 1-9 in a set of printed fonts, for the photo reader.

Writes glyphs.json: for each font and digit, the inked pixels of the glyph
cropped to its bounding box. scripts/build-digit-templates.ts then reduces each
glyph with the same code the app uses on a photo (normalizeGlyph in
src/lib/photo.ts) and writes src/lib/digit-templates.ts.

Needs Python 3 with Pillow and the fonts below (the Debian/Ubuntu packages
fonts-dejavu, fonts-liberation, fonts-freefont-ttf, fonts-crosextra-carlito,
fonts-crosextra-caladea, fonts-inter and fonts-jetbrains-mono). Missing fonts are skipped.

    python3 scripts/digit-templates/render_fonts.py > /tmp/glyphs.json
    npx tsx scripts/build-digit-templates.ts /tmp/glyphs.json
"""
import json
import os
import sys

from PIL import Image, ImageDraw, ImageFont

FONTS = [
    "truetype/dejavu/DejaVuSans.ttf",
    "truetype/dejavu/DejaVuSans-Bold.ttf",
    "truetype/dejavu/DejaVuSerif.ttf",
    "truetype/dejavu/DejaVuSerif-Bold.ttf",
    "truetype/dejavu/DejaVuSansMono.ttf",
    "truetype/liberation/LiberationSans-Regular.ttf",
    "truetype/liberation/LiberationSans-Bold.ttf",
    "truetype/liberation/LiberationSerif-Regular.ttf",
    "truetype/liberation/LiberationSerif-Bold.ttf",
    "truetype/liberation/LiberationMono-Regular.ttf",
    "truetype/freefont/FreeSans.ttf",
    "truetype/freefont/FreeSansBold.ttf",
    "truetype/freefont/FreeSerif.ttf",
    "truetype/freefont/FreeSerifBold.ttf",
    "truetype/jetbrains-mono/JetBrainsMono-Regular.ttf",
    "truetype/jetbrains-mono/JetBrainsMono-Bold.ttf",
    "truetype/crosextra/Carlito-Regular.ttf",
    "truetype/crosextra/Carlito-Bold.ttf",
    "truetype/crosextra/Caladea-Regular.ttf",
    "truetype/crosextra/Caladea-Bold.ttf",
    "opentype/inter/Inter-Regular.otf",
    "opentype/inter/Inter-SemiBold.otf",
    "opentype/inter/Inter-Bold.otf",
]

SIZE = 96

glyphs = []
for rel in FONTS:
    path = os.path.join("/usr/share/fonts", rel)
    if not os.path.exists(path):
        print(f"skipping {rel}", file=sys.stderr)
        continue
    font = ImageFont.truetype(path, SIZE)
    for digit in range(1, 10):
        image = Image.new("L", (SIZE * 2, SIZE * 2), 0)
        ImageDraw.Draw(image).text((SIZE // 2, SIZE // 4), str(digit), fill=255, font=font)
        box = image.getbbox()
        crop = image.crop(box)
        w, h = crop.size
        bits = "".join("1" if v >= 128 else "0" for v in crop.tobytes())
        glyphs.append({"font": os.path.basename(rel), "digit": digit, "width": w, "height": h, "bits": bits})

json.dump(glyphs, sys.stdout)
