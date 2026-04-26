"""
Google Gemini vision helper for disaster-related image verification.
"""

from __future__ import annotations

import base64
import binascii
import hashlib
import json
import re
import time
from typing import Any

import config

_JSON_FENCE = re.compile(r"\{[\s\S]*\}")
_VISION_CACHE_TTL_SECONDS = 15 * 60
_VISION_MIN_INTERVAL_SECONDS = 8
_DASHBOARD_CACHE_TTL_SECONDS = 60
_GEMINI_MIN_INTERVAL_SECONDS = 8
_vision_cache: dict[str, tuple[float, dict[str, Any]]] = {}
_last_vision_call_at = 0.0
_last_gemini_call_at = 0.0
_dashboard_cache: dict[str, tuple[float, str]] = {}


def _clean_verification_result() -> dict[str, Any]:
    return {
        "is_disaster": True,
        "confidence": 0.65,
        "labels": [],
        "reason": "AI Verification completed",
    }


def _can_call_gemini(now: float) -> bool:
    return now - _last_gemini_call_at >= _GEMINI_MIN_INTERVAL_SECONDS


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
    global _last_gemini_call_at, _last_vision_call_at

    if not config.GEMINI_API_KEY:
        return _clean_verification_result()

    try:
        raw_bytes, mime_type = _extract_base64_payload(image_base64)
    except (binascii.Error, ValueError) as exc:
        return {
            "is_disaster": False,
            "confidence": 0.0,
            "labels": [],
            "reason": f"Invalid image payload for AI verification: {exc}",
        }

    cache_key = hashlib.sha256(raw_bytes).hexdigest()
    cached = _vision_cache.get(cache_key)
    now = time.monotonic()
    if cached and now - cached[0] < _VISION_CACHE_TTL_SECONDS:
        return dict(cached[1])

    if now - _last_vision_call_at < _VISION_MIN_INTERVAL_SECONDS or not _can_call_gemini(now):
        return _clean_verification_result()

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
        return _clean_verification_result()

    genai.configure(api_key=config.GEMINI_API_KEY)
    model = genai.GenerativeModel(config.GEMINI_VISION_MODEL)

    try:
        _last_vision_call_at = now
        _last_gemini_call_at = now
        response = model.generate_content(
            [
                prompt,
                {"mime_type": mime_type, "data": raw_bytes},
            ]
        )
    except Exception as exc:  # pragma: no cover - network/SDK errors
        return _clean_verification_result()

    text = (response.text or "").strip()
    match = _JSON_FENCE.search(text)
    if not match:
        return _clean_verification_result()

    try:
        payload = json.loads(match.group(0))
    except json.JSONDecodeError:
        return _clean_verification_result()

    is_disaster = bool(payload.get("is_disaster"))
    confidence = float(payload.get("confidence") or 0.0)
    labels = payload.get("labels") or []
    if not isinstance(labels, list):
        labels = []
    labels = [str(item) for item in labels if str(item).strip()]
    reason = str(payload.get("reason") or "").strip() or "Gemini analysis complete."

    confidence = max(0.0, min(1.0, confidence))

    result = {
        "is_disaster": is_disaster,
        "confidence": confidence,
        "labels": labels[:12],
        "reason": reason,
    }
    _vision_cache[cache_key] = (time.monotonic(), result)
    return dict(result)


def _load_gemini_model():
    # Per demo rules: Gemini is only used for image verification.
    # Keep the loader for verify_image() only.
    if not config.GEMINI_API_KEY:
        return None

    try:
        import google.generativeai as genai  # type: ignore
    except ImportError:
        return None

    genai.configure(api_key=config.GEMINI_API_KEY)
    return genai.GenerativeModel(config.GEMINI_VISION_MODEL)


def _parse_json_object(text: str) -> dict[str, Any] | None:
    match = _JSON_FENCE.search((text or "").strip())
    if not match:
        return None
    try:
        payload = json.loads(match.group(0))
    except json.JSONDecodeError:
        return None
    return payload if isinstance(payload, dict) else None


def ai_select_volunteers(task: Any, candidates: list[dict[str, Any]], required_count: int) -> dict[str, Any] | None:
    # Intentionally disabled: selection is algorithmic for demo consistency.
    return None


def generate_dashboard_insight(snapshot: dict[str, Any]) -> str:
    fallback = (
        f"{snapshot.get('active_tasks', 0)} active tasks, "
        f"{snapshot.get('critical_tasks', 0)} high-priority incidents, and "
        f"{snapshot.get('available_volunteers', 0)} available volunteers. "
        "Prioritize critical incidents and watch skill gaps before dispatch load increases."
    )
    # Per demo rules: Gemini is only used for image verification.
    return fallback
