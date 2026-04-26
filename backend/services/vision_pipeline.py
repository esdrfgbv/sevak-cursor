"""
Combines local image validation with Gemini vision analysis.
"""

from __future__ import annotations

import re
from typing import Any

from .. import config
from .gemini_service import verify_image as gemini_verify_image
from .image_verification import verify_image_data

_STOP_WORDS = {
    "the",
    "and",
    "with",
    "from",
    "that",
    "this",
    "have",
    "has",
    "for",
    "are",
    "was",
    "were",
    "into",
    "near",
    "over",
}


def _tokenize(*chunks: str) -> set[str]:
    tokens: set[str] = set()
    for chunk in chunks:
        if not chunk:
            continue
        for token in re.findall(r"[a-z0-9]+", chunk.lower()):
            if len(token) > 2 and token not in _STOP_WORDS:
                tokens.add(token)
    return tokens


def _label_overlap(description: str, incident_type: str, labels: list[str], gemini_reason: str) -> float:
    text_tokens = _tokenize(description, incident_type)
    label_blob = " ".join(labels) + " " + gemini_reason
    label_tokens = _tokenize(label_blob)
    if not label_tokens:
        return 1.0
    if not text_tokens:
        return 0.0
    inter = len(text_tokens.intersection(label_tokens))
    union = len(text_tokens.union(label_tokens))
    return inter / union


def analyze_incident_image(
    *,
    image_data: str | None,
    incident_type: str,
    description: str,
) -> tuple[str, str, str | None, dict[str, Any]]:
    """
    Returns: (status, reason, image_url, verification dict for API)
    """
    local_status, local_reason, image_url = verify_image_data(image_data)
    warnings: list[str] = []

    if local_status == "rejected":
        summary = {
            "is_disaster": False,
            "confidence": 0.0,
            "labels": [],
            "reason": local_reason,
            "warnings": warnings,
        }
        return "rejected", local_reason, image_url, summary

    if local_status == "not_submitted":
        summary = {
            "is_disaster": None,
            "confidence": None,
            "labels": [],
            "reason": local_reason,
            "warnings": warnings,
        }
        return "not_submitted", local_reason, image_url, summary

    gemini = gemini_verify_image(image_data or "")
    labels = list(gemini.get("labels") or [])
    confidence = float(gemini.get("confidence") or 0.0)
    is_disaster = bool(gemini.get("is_disaster"))
    gemini_reason = str(gemini.get("reason") or "")

    if not is_disaster:
        msg = "AI verification: image does not appear to show an active disaster or emergency."
        warnings.append("Image does not appear to show disaster evidence")
        summary = {
            "is_disaster": False,
            "confidence": confidence,
            "labels": labels,
            "reason": gemini_reason or msg,
            "warnings": warnings,
        }
        combined = f"{local_reason} {msg} ({gemini_reason})".strip()
        return "rejected", combined, image_url, summary

    if confidence < config.GEMINI_MIN_CONFIDENCE:
        warnings.append("Low confidence in disaster detection")
        summary = {
            "is_disaster": True,
            "confidence": confidence,
            "labels": labels,
            "reason": gemini_reason,
            "warnings": warnings,
        }
        combined = f"{local_reason} Low model confidence ({confidence:.2f}). {gemini_reason}".strip()
        return "low_confidence", combined, image_url, summary

    overlap = _label_overlap(description, incident_type, labels, gemini_reason)
    if overlap < 0.12 and labels and confidence < 0.78:
        warnings.append("Image does not match description")
        summary = {
            "is_disaster": True,
            "confidence": confidence,
            "labels": labels,
            "reason": gemini_reason,
            "warnings": warnings,
        }
        combined = (
            f"{local_reason} Possible mismatch between narrative and image cues "
            f"(overlap {overlap:.2f}). {gemini_reason}"
        ).strip()
        return "description_mismatch", combined, image_url, summary

    summary = {
        "is_disaster": True,
        "confidence": confidence,
        "labels": labels,
        "reason": gemini_reason,
        "warnings": warnings,
    }
    combined = f"{local_reason} {gemini_reason}".strip()
    return "verified", combined, image_url, summary
