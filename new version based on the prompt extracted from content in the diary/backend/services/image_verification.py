import base64
import binascii


MAX_IMAGE_BYTES = 2 * 1024 * 1024
ALLOWED_MIME_TYPES = {"image/jpeg", "image/png", "image/webp"}


def verify_image_data(image_data: str | None) -> tuple[str, str, str | None]:
    if not image_data:
        return "not_submitted", "No image was attached for verification.", None

    if "," not in image_data or not image_data.startswith("data:"):
        return "rejected", "Upload could not be read as an image data URL.", None

    header, encoded = image_data.split(",", 1)
    mime_type = header.removeprefix("data:").split(";", 1)[0].lower()
    if mime_type not in ALLOWED_MIME_TYPES:
        return "rejected", "Only JPEG, PNG, and WebP evidence images are accepted.", None

    try:
        raw = base64.b64decode(encoded, validate=True)
    except (binascii.Error, ValueError):
        return "rejected", "Image evidence is not valid base64 data.", None

    if not raw:
        return "rejected", "Image evidence is empty.", None

    if len(raw) > MAX_IMAGE_BYTES:
        return "rejected", "Image evidence is larger than 2 MB.", None

    if mime_type == "image/png" and not raw.startswith(b"\x89PNG\r\n\x1a\n"):
        return "rejected", "PNG evidence failed signature verification.", None

    if mime_type == "image/jpeg" and not raw.startswith(b"\xff\xd8\xff"):
        return "rejected", "JPEG evidence failed signature verification.", None

    if mime_type == "image/webp" and not (raw.startswith(b"RIFF") and raw[8:12] == b"WEBP"):
        return "rejected", "WebP evidence failed signature verification.", None

    return "verified", "Image evidence passed file type, signature, and size checks.", image_data
