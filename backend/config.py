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
FIREBASE_PROJECT_ID: str | None = os.getenv("FIREBASE_PROJECT_ID")

# Demo Location Settings (Hyderabad)
BASE_LAT: float = float(os.getenv("BASE_LAT", "17.3850"))
BASE_LNG: float = float(os.getenv("BASE_LNG", "78.4867"))
DEMO_RADIUS_KM: float = float(os.getenv("DEMO_RADIUS_KM", "20"))
MAX_ASSIGNMENT_DISTANCE_KM: float = float(os.getenv("MAX_ASSIGNMENT_DISTANCE_KM", "50"))

GEMINI_API_KEY: str | None = os.getenv("GEMINI_API_KEY") or None
GEMINI_VISION_MODEL: str = os.getenv("GEMINI_VISION_MODEL", "gemini-1.5-flash")
GEMINI_MIN_CONFIDENCE: float = float(os.getenv("GEMINI_MIN_CONFIDENCE", "0.55"))
