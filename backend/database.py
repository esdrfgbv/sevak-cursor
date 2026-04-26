"""Database shim — SQLAlchemy removed. Firebase is the DB."""
from __future__ import annotations

Base = None
SessionLocal = None
engine = None


def get_db():
    """Legacy shim — not used. Firebase service handles all data access."""
    raise RuntimeError("SQLAlchemy removed. Use firebase_service instead.")
