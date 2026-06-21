from PIL import Image, ImageDraw

def make_icon(size, path):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    r = int(size * 0.1875)
    d.rounded_rectangle([0, 0, size - 1, size - 1], radius=r, fill=(91, 70, 54, 255))

    cx, cy = size * 0.5, size * 0.50
    sw = max(2, int(size * 0.043))
    color = (246, 241, 234, 255)

    # horseshoe arc (open at bottom)
    bbox_r = size * 0.30
    bbox = [cx - bbox_r, cy - bbox_r * 1.05, cx + bbox_r, cy + bbox_r * 1.05]
    d.arc(bbox, start=200, end=340, fill=color, width=sw)

    # inner arc
    inner_r = bbox_r * 0.62
    bbox_in = [cx - inner_r, cy - inner_r * 1.05, cx + inner_r, cy + inner_r * 1.05]
    d.arc(bbox_in, start=200, end=340, fill=color, width=sw)

    # nail holes (small circles along the horseshoe)
    import math
    hole_r = max(2, int(size * 0.022))
    for ang_deg in (210, 235, 260, 285, 310, 330):
        ang = math.radians(ang_deg)
        hx = cx + bbox_r * 0.81 * math.cos(ang)
        hy = cy + bbox_r * 1.02 * 0.81 * math.sin(ang)
        d.ellipse([hx - hole_r, hy - hole_r, hx + hole_r, hy + hole_r], fill=color)

    img.save(path)

make_icon(192, "icon-192.png")
make_icon(512, "icon-512.png")
print("done")
