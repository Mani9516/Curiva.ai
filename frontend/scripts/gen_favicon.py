"""Generate Curiva favicons from the brand logo PNG."""
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"
ASSETS = ROOT / "src" / "assets"
DEFAULT_LOGO = ASSETS / "curiva-logo.png"
CURSOR_LOGO = Path(
    r"C:\Users\ManiChourasiya(G10XI\.cursor\projects"
    r"\c-Users-ManiChourasiya-G10XI-gemini-antigravity-scratch-travix-ai\assets"
    r"\c__Users_ManiChourasiya_G10XI_AppData_Roaming_Cursor_User_workspaceStorage"
    r"_b992d63508545ca5d63ee809ca81bc0c_images_image-cb315dec-4799-493c-9bf5-59ed58f51535.png"
)


def resolve_logo() -> Path:
    if DEFAULT_LOGO.exists():
        return DEFAULT_LOGO
    if CURSOR_LOGO.exists():
        return CURSOR_LOGO
    raise SystemExit("Curiva logo PNG not found.")


def main() -> None:
    logo_path = resolve_logo()
    img = Image.open(logo_path).convert("RGBA")
    w, h = img.size

    # Icon-only crop (heart/stethoscope mark on the left).
    icon_w = int(w * 0.42)
    icon = img.crop((0, 0, icon_w, h))

    side = max(icon.size)
    square = Image.new("RGBA", (side, side), (255, 255, 255, 0))
    ox = (side - icon.size[0]) // 2
    oy = (side - icon.size[1]) // 2
    square.paste(icon, (ox, oy), icon)

    for size, name in [
        (32, "favicon-32x32.png"),
        (16, "favicon-16x16.png"),
        (180, "apple-touch-icon.png"),
        (192, "favicon.png"),
    ]:
        square.resize((size, size), Image.Resampling.LANCZOS).save(
            PUBLIC / name, format="PNG"
        )

    square.resize((32, 32), Image.Resampling.LANCZOS).save(
        PUBLIC / "favicon.ico", format="ICO", sizes=[(16, 16), (32, 32)]
    )

    if logo_path != DEFAULT_LOGO:
        img.save(DEFAULT_LOGO, format="PNG")

    print(f"Created favicons from {logo_path.name} ({w}x{h}) in {PUBLIC}")


if __name__ == "__main__":
    main()
