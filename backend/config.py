"""Central configuration for SEVAK."""
from __future__ import annotations
import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(dotenv_path=Path(__file__).parent / ".env")

FIREBASE_CREDENTIALS_PATH: str | None = os.getenv(
    "FIREBASE_CREDENTIALS_PATH",
    str(Path(__file__).parent / "firebase-credentials.json"),
)

GEMINI_API_KEY: str | None = os.getenv("GEMINI_API_KEY") or None
GEMINI_VISION_MODEL: str = os.getenv("GEMINI_VISION_MODEL", "gemini-1.5-flash")
GEMINI_MIN_CONFIDENCE: float = float(os.getenv("GEMINI_MIN_CONFIDENCE", "0.55"))
