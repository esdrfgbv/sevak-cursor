"""Central configuration for DisasterIQ (simulation + production toggle)."""

from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(dotenv_path=Path(__file__).parent / ".env")


def _truthy(value: str | None, default: str = "true") -> bool:
    raw = (value if value is not None else default).strip().lower()
    return raw in {"1", "true", "yes", "on"}


# Simulation mode: use in-process SQLite + mock dataset (no MySQL connection).
USE_MOCK_DATA: bool = _truthy(os.getenv("USE_MOCK_DATA"), default="true")

# Preserved for switching back to MySQL / Postgres without code rewrites.
DATABASE_URL: str | None = os.getenv(
    "DATABASE_URL",
    "mysql+pymysql://root:password@localhost:3306/disasteriq",
)

GEMINI_API_KEY: str | None = os.getenv("GEMINI_API_KEY") or None
GEMINI_VISION_MODEL: str = os.getenv("GEMINI_VISION_MODEL", "gemini-2.0-flash")
GEMINI_MIN_CONFIDENCE: float = float(os.getenv("GEMINI_MIN_CONFIDENCE", "0.55"))
