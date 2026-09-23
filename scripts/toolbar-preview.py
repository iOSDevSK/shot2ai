"""screenshots/toolbar-icon.png: the Shot2AI icon at 16 px (1x) and 32 px (2x)
on a light and a dark Chrome toolbar, between generic toolbar icons, zoomed
with nearest-neighbour so single pixels are visible."""
import math
from PIL import Image, ImageDraw

def glyph(kind, scale, fg):
    s = 16 * scale; im = Image.new('RGBA', (s, s), (0, 0, 0, 0)); d = ImageDraw.Draw(im); w = max(1, round(1.6 * scale))
    if kind == 'puzzle':
        d.rounded_rectangle([2*scale, 4*scale, 12*scale, 14*scale], radius=2*scale, outline=fg, width=w)
        d.ellipse([5*scale, 1*scale, 9*scale, 5*scale], outline=fg, width=w); d.ellipse([11*scale, 7*scale, 15*scale, 11*scale], outline=fg, width=w)
    elif kind == 'star':
        pts = [(8*scale + (7 if i % 2 == 0 else 3)*scale*math.cos(-math.pi/2 + i*math.pi/5), 8.5*scale + (7 if i % 2 == 0 else 3)*scale*math.sin(-math.pi/2 + i*math.pi/5)) for i in range(10)]
        d.polygon(pts, outline=fg, width=w)
    else:
        d.ellipse([1*scale, 1*scale, 15*scale, 15*scale], outline=fg, width=w); d.ellipse([5.5*scale, 4*scale, 10.5*scale, 9*scale], outline=fg, width=w)
    return im

def bar(bg, fg, scale):
    items = [glyph('puzzle', scale, fg), Image.open(f'icons/icon-{16*scale}.png'), glyph('star', scale, fg), glyph('profile', scale, fg)]
    step = 28 * scale; im = Image.new('RGB', (12*scale + len(items)*step, 36*scale), bg); x = 12*scale
    for it in items: im.paste(it, (x, 10*scale), it); x += step
    return im

rows = [bar(bg, fg, s) for s in (1, 2) for bg, fg in (((241, 243, 244), (95, 99, 104)), ((53, 54, 58), (199, 199, 199)))]
zoom = [r.resize((r.width*(4 if r.height < 60 else 2), r.height*(4 if r.height < 60 else 2)), Image.NEAREST) for r in rows]
out = Image.new('RGB', (max(z.width for z in zoom), sum(z.height for z in zoom) + 8*len(zoom)), 'white'); y = 0
for z in zoom: out.paste(z, (0, y)); y += z.height + 8
out.save('screenshots/toolbar-icon.png')
