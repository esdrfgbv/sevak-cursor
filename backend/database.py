"""
Database engine configuration.

Simulation mode (USE_MOCK_DATA=true, default) uses an in-process SQLite database so
MySQL is not contacted. The original MySQL connection string remains available
via config.DATABASE_URL when switching back to a real database.
"""

from __future__ import annotations

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from sqlalchemy.pool import StaticPool

from . import config

# --- Preserved MySQL configuration (not used while USE_MOCK_DATA is true) ---
# DATABASE_URL = os.getenv(
#     "DATABASE_URL",
#     "mysql+pymysql://root:password@localhost:3306/disasteriq",
# )
# engine = create_engine(DATABASE_URL, future=True, pool_pre_ping=True)

if config.USE_MOCK_DATA:
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        future=True,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
else:
    if not config.DATABASE_URL:
        raise RuntimeError("DATABASE_URL must be set when USE_MOCK_DATA is false.")

    connect_args = {"check_same_thread": False} if config.DATABASE_URL.startswith("sqlite") else {}
    engine = create_engine(config.DATABASE_URL, future=True, pool_pre_ping=True, connect_args=connect_args)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine, future=True)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
