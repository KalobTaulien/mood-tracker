#!/usr/bin/env python3
"""
Generates the Mood Tracker logo assets.

The mark is a crescent moon, which is already the app's symbol: the onboarding
hero and the History empty state both render Ionicons' `moon`. Keeping the
splash consistent with that means the launch image and the first screen the
user sees are the same shape.

The crescent is built by subtracting an offset disc from a disc, drawn at 4x
and downsampled, because PIL's ellipse has no antialiasing of its own.

Run: python3 scripts/make-logo.py
"""

from PIL import Image, ImageChops, ImageDraw

SIZE = 1024
SUPERSAMPLE = 4

# Matches src/theme.ts: `accent` in the light and dark palettes.
ACCENT_LIGHT = (0x5B, 0x6C, 0xFF, 0xFF)
ACCENT_DARK = (0x8B, 0x98, 0xFF, 0xFF)

# Proportions of the canvas. Tuned so the crescent is thick enough to stay
# legible at favicon size while keeping an open, moon-like mouth.
OUTER_R = 0.40
CUTTER_R = 0.345
CUTTER_OFFSET = 0.125  # right and up, so the opening faces the top-right

# Breathing room around the trimmed mark, as a fraction of its longest side.
MARGIN = 0.06

# App-icon palette: a white crescent on the brand accent. The background
# matches `android.adaptiveIcon.backgroundColor` already set in app.json.
ACCENT_BG = (0x5B, 0x6C, 0xFF)
WHITE = (0xFF, 0xFF, 0xFF, 0xFF)

# How much of the icon canvas the mark occupies.
ICON_SCALE = 0.60
# Android masks the foreground to the middle ~66%, so the mark sits smaller.
ADAPTIVE_SCALE = 0.44


def crescent(color: tuple[int, int, int, int], size: int = SIZE) -> Image.Image:
    """A transparent-background crescent moon in `color`."""
    w = size * SUPERSAMPLE
    centre = w / 2

    disc = Image.new("RGBA", (w, w), (0, 0, 0, 0))
    r = w * OUTER_R
    ImageDraw.Draw(disc).ellipse(
        [centre - r, centre - r, centre + r, centre + r], fill=color
    )

    cutter = Image.new("L", (w, w), 0)
    cr = w * CUTTER_R
    cx = centre + w * CUTTER_OFFSET
    cy = centre - w * CUTTER_OFFSET
    ImageDraw.Draw(cutter).ellipse([cx - cr, cy - cr, cx + cr, cy + cr], fill=255)

    # Punch the cutter out of the disc's alpha channel.
    disc.putalpha(ImageChops.subtract(disc.getchannel("A"), cutter))

    # The crescent's tips make its bounding box asymmetric, so the drawn shape
    # is not centred in the canvas even though the discs were. The splash
    # screen centres whatever image it is given, which would put the moon
    # visibly off to one side — so trim to the ink and re-centre it here.
    bbox = disc.getbbox()
    if bbox:
        ink = disc.crop(bbox)
        side = max(ink.width, ink.height)
        margin = int(side * MARGIN)
        canvas = side + margin * 2
        centred = Image.new("RGBA", (canvas, canvas), (0, 0, 0, 0))
        centred.paste(
            ink, ((canvas - ink.width) // 2, (canvas - ink.height) // 2), ink
        )
        disc = centred

    return disc.resize((size, size), Image.LANCZOS)


def on_background(
    size: int,
    background: tuple[int, int, int],
    ink: tuple[int, int, int, int],
    scale: float,
) -> Image.Image:
    """The mark at `scale` of the canvas, centred on an opaque background."""
    canvas = Image.new("RGB", (size, size), background)
    mark_size = max(1, int(size * scale))
    mark = crescent(ink, mark_size)
    offset = (size - mark_size) // 2
    canvas.paste(mark, (offset, offset), mark)
    return canvas


def transparent_mark(
    size: int, ink: tuple[int, int, int, int], scale: float
) -> Image.Image:
    """The mark at `scale` of the canvas, centred on transparency."""
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    mark_size = max(1, int(size * scale))
    mark = crescent(ink, mark_size)
    offset = (size - mark_size) // 2
    canvas.paste(mark, (offset, offset), mark)
    return canvas


def main() -> None:
    # Splash and master mark: the bare crescent on transparency, tinted per
    # appearance so it reads on both the light and dark splash backgrounds.
    for path, color in [
        ("assets/logo.png", ACCENT_LIGHT),
        ("assets/splash-icon.png", ACCENT_LIGHT),
        ("assets/splash-icon-dark.png", ACCENT_DARK),
    ]:
        crescent(color).save(path)
        print(f"wrote {path}")

    # iOS app icon. Must be opaque with square corners and no alpha channel —
    # iOS applies its own mask, and an icon with transparency is rejected at
    # submission. The accent background matches android.adaptiveIcon's.
    on_background(1024, ACCENT_BG, WHITE, ICON_SCALE).save("assets/icon.png")
    print("wrote assets/icon.png")

    # Android adaptive icon. The launcher masks the foreground to a circle or
    # squircle and can animate it, so only the middle ~66% is guaranteed
    # visible — hence the smaller scale here than on the iOS icon.
    transparent_mark(512, WHITE, ADAPTIVE_SCALE).save("assets/android-icon-foreground.png")
    print("wrote assets/android-icon-foreground.png")

    Image.new("RGB", (512, 512), ACCENT_BG).save("assets/android-icon-background.png")
    print("wrote assets/android-icon-background.png")

    # Themed icons: the system recolours this silhouette, so it ships as a
    # plain white shape on transparency.
    transparent_mark(432, WHITE, ADAPTIVE_SCALE).save("assets/android-icon-monochrome.png")
    print("wrote assets/android-icon-monochrome.png")

    on_background(48, ACCENT_BG, WHITE, ICON_SCALE).save("assets/favicon.png")
    print("wrote assets/favicon.png")


if __name__ == "__main__":
    main()
