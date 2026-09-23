"""Draws the Shot2AI toolbar icons: white capture corners and a lime centre
on a saturated green rounded square that fills the canvas. The 16 and 32 px
sizes are laid out on the pixel grid by hand; 48 and 128 follow the same
proportions. Run from the repo root: python3 scripts/icons.py"""
from PIL import Image, ImageDraw

GREEN = (22, 150, 76, 255)      # stands out on light and dark toolbars
WHITE = (255, 255, 255, 255)
LIME = (200, 245, 120, 255)

def square(size, radius):
    """The rounded square, antialiased by drawing at 8x and scaling down."""
    big = Image.new('RGBA', (size * 8, size * 8), (0, 0, 0, 0))
    ImageDraw.Draw(big).rounded_rectangle([0, 0, size * 8 - 1, size * 8 - 1], radius=radius * 8, fill=GREEN)
    return big.resize((size, size), Image.LANCZOS)

def pixel_icon(size, radius, inset, stroke, arm, centre):
    """Corners and centre on exact pixels, so the small sizes stay crisp."""
    img = square(size, radius)
    d = ImageDraw.Draw(img)
    lo, hi = inset, size - 1 - inset
    for x, dx in ((lo, 1), (hi, -1)):
        for y, dy in ((lo, 1), (hi, -1)):
            xs = sorted([x, x + dx * (arm - 1)]); ys = sorted([y, y + dy * (stroke - 1)])
            d.rectangle([xs[0], ys[0], xs[1], ys[1]], fill=WHITE)   # horizontal arm
            xs = sorted([x, x + dx * (stroke - 1)]); ys = sorted([y, y + dy * (arm - 1)])
            d.rectangle([xs[0], ys[0], xs[1], ys[1]], fill=WHITE)   # vertical arm
    c0 = (size - centre) // 2
    d.rectangle([c0, c0, c0 + centre - 1, c0 + centre - 1], fill=LIME)
    return img

def smooth_icon(size):
    """48 and 128: the 32 px layout, drawn large with round ends and scaled."""
    k = 8 * size / 32
    big = Image.new('RGBA', (int(32 * k), int(32 * k)), (0, 0, 0, 0))
    d = ImageDraw.Draw(big)
    d.rounded_rectangle([0, 0, big.width - 1, big.height - 1], radius=6.5 * k, fill=GREEN)
    # Stroke centres of the 32 px grid: corners at 6, arms 5.5 long plus round ends.
    w, lo, arm = 4 * k, 6 * k, 5.5 * k
    hi = 31 * k - lo + k
    def line(a, b):
        d.line([a, b], fill=WHITE, width=round(w))
        for p in (a, b):
            d.ellipse([p[0] - w / 2, p[1] - w / 2, p[0] + w / 2, p[1] + w / 2], fill=WHITE)
    for x, dx in ((lo, 1), (hi, -1)):
        for y, dy in ((lo, 1), (hi, -1)):
            line((x, y), (x + dx * arm, y)); line((x, y), (x, y + dy * arm))
    c = 16 * k; r = 4 * k
    d.rounded_rectangle([c - r, c - r, c + r, c + r], radius=1.2 * k, fill=LIME)
    return big.resize((size, size), Image.LANCZOS)

icons = {
    16: pixel_icon(16, radius=3, inset=2, stroke=2, arm=4, centre=4),
    32: pixel_icon(32, radius=6, inset=4, stroke=4, arm=9, centre=8),
    48: smooth_icon(48),
    128: smooth_icon(128),
}
if __name__ == '__main__':
    for s, img in icons.items():
        img.save(f'icons/icon-{s}.png')
