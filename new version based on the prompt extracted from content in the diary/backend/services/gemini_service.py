"""
Google Gemini vision helper for disaster-related image verification.
"""

from __future__ import annotations

import base64
import binascii
import json
import re
from typing import Any

from .. import config

_JSON_FENCE = re.compile(r"\{[\s\S]*\}")


def _extract_base64_payload(image_data: str) -> tuple[bytes, str]:
    if not image_data:
        raise ValueError("empty image payload")

    if image_data.startswith("data:") and "," in image_data:
        header, encoded = image_data.split(",", 1)
        mime = header.removeprefix("data:").split(";", 1)[0].lower()
        raw = base64.b64decode(encoded, validate=True)
        return raw, mime

    raw = base64.b64decode(image_data, validate=True)
    return raw, "image/jpeg"


def verify_image(image_base64: str) -> dict[str, Any]:
    """
    Returns a dict with keys: is_disaster (bool), confidence (0..1), labels (list[str]), reason (str)
    """
    if not config.GEMINI_API_KEY:
        return {
            "is_disaster": True,
            "confidence": 1.0,
            "labels": [],
            "reason": "GEMINI_API_KEY not configured; vision verification skipped.",
        }

    try:
        raw_bytes, mime_type = _extract_base64_payload(image_base64)
    except (binascii.Error, ValueError) as exc:
        return {
            "is_disaster": False,
            "confidence": 0.0,
            "labels": [],
            "reason": f"Invalid image payload for Gemini: {exc}",
        }

    prompt = (
        "You are an emergency operations vision analyst. Inspect the image and decide if it shows "
        "a disaster, emergency, structural damage, fire, flood water impacting people, injured people, "
        "collapsed buildings, or other life-safety incident evidence.\n"
        "Return ONLY compact JSON with keys:\n"
        '{ "is_disaster": true|false, "confidence": number between 0 and 1, '
        '"labels": ["short phrases"], "reason": "one or two sentences" }\n'
        "Be conservative: if unclear, set is_disaster false with low confidence."
    )

    try:
        import google.generativeai as genai  # type: ignore
    except ImportError:
        return {
            "is_disaster": True,
            "confidence": 1.0,
            "labels": [],
            "reason": "google-generativeai package missing; install requirements.txt.",
        }

    genai.configure(api_key=config.GEMINI_API_KEY)
    model = genai.GenerativeModel(config.GEMINI_VISION_MODEL)

    try:
        response = model.generate_content(
            [
                prompt,
                {"mime_type": mime_type, "data": raw_bytes},
            ]
        )
    except Exception as exc:  # pragma: no cover - network/SDK errors
        return {
            "is_disaster": True,
            "confidence": 0.55,
            "labels": [],
            "reason": f"Gemini request failed ({exc.__class__.__name__}); continuing with caution.",
        }

    text = (response.text or "").strip()
    match = _JSON_FENCE.search(text)
    if not match:
        return {
            "is_disaster": True,
            "confidence": 0.35,
            "labels": [],
            "reason": "Gemini returned non-JSON output; treating as inconclusive.",
        }

    try:
        payload = json.loads(match.group(0))
    except json.JSONDecodeError:
        return {
            "is_disaster": True,
            "confidence": 0.35,
            "labels": [],
            "reason": "Could not parse Gemini JSON; treating as inconclusive.",
        }

    is_disaster = bool(payload.get("is_disaster"))
    confidence = float(payload.get("confidence") or 0.0)
    labels = payload.get("labels") or []
    if not isinstance(labels, list):
        labels = []
    labels = [str(item) for item in labels if str(item).strip()]
    reason = str(payload.get("reason") or "").strip() or "Gemini analysis complete."

    confidence = max(0.0, min(1.0, confidence))

    return {
        "is_disaster": is_disaster,
        "confidence": confidence,
        "labels": labels[:12],
        "reason": reason,
    }
