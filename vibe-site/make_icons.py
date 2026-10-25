# App icons for the installable site (PWA): dark tile, white "VC", red bar — same look as favicon.svg.
# Content stays inside the middle 60% so phones can crop it to a circle (maskable).
import pathlib
from PIL import Image, ImageDraw, ImageFont
out = pathlib.Path(__file__).parent / 'vercel-site' / 'public'
FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
for size in (192, 512, 180):
    im = Image.new('RGB', (size, size), '#121418')
    d = ImageDraw.Draw(im)
    f = ImageFont.truetype(FONT, int(size * 0.30))
    w = d.textlength('VC', font=f)
    d.text(((size - w) / 2, size * 0.30), 'VC', font=f, fill='#ffffff')
    d.rectangle([size * 0.28, size * 0.66, size * 0.72, size * 0.70], fill='#e5393a')
    im.save(out / ('apple-touch-icon.png' if size == 180 else f'icon-{size}.png'))
print('icons ok')
