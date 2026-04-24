from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select
from sqlalchemy import text
from sqlalchemy.orm import Session

from . import config, mock_data, models, schemas
from .database import Base, SessionLocal, engine, get_db
from .routers import assignments, requests, users
from .routers.auth import login_user
from .services.assignment_engine import run_assignment
from .services.state_manager import update_request_status


def seed_data():
    db = SessionLocal()
    try:
        if config.USE_MOCK_DATA:
            mock_data.seed_simulation_dataset(db, models)
            requests = db.scalars(select(models.Request)).all()
            for request_obj in requests:
                if not request_obj.assignments:
                    run_assignment(db, request_obj.id)
                update_request_status(db, request_obj)
            db.commit()
            return

        if db.scalar(select(models.User.id).limit(1)):
            return

        skill_names = [
            "Medical",
            "Search and Rescue",
            "Swift Water Rescue",
            "Logistics",
            "Electrical",
            "Firefighting",
        ]
        skills = {}
        for name in skill_names:
            skill = models.Skill(name=name)
            db.add(skill)
            db.flush()
            skills[name] = skill

        volunteers = [
            ("Asha Patel", 12.973, 77.594, ["Medical", "Search and Rescue"]),
            ("Rahul Menon", 12.968, 77.601, ["Swift Water Rescue", "Logistics"]),
            ("Neha Singh", 12.976, 77.588, ["Electrical", "Firefighting"]),
            ("David Roy", 12.971, 77.607, ["Medical", "Logistics"]),
        ]
        for name, lat, lng, skill_set in volunteers:
            volunteer = models.User(
                name=name,
                role="volunteer",
                lat=lat,
                lng=lng,
                availability=True,
                status="available",
            )
            volunteer.skills = [skills[item] for item in skill_set]
            db.add(volunteer)

        requester = models.User(name="Field Officer", role="requester", lat=12.9716, lng=77.5946, availability=True)
        admin = models.User(name="Command Admin", role="admin", lat=12.9716, lng=77.5946, availability=True)
        db.add_all([requester, admin])
        db.commit()
    finally:
        db.close()


def add_column_if_missing(table_name: str, column_name: str, definition: str):
    dialect_name = engine.dialect.name
    with engine.begin() as connection:
        if dialect_name == "sqlite":
            rows = connection.execute(text(f"PRAGMA table_info({table_name})")).mappings()
            if column_name in {row["name"] for row in rows}:
                return
        else:
            rows = connection.execute(text(f"SHOW COLUMNS FROM {table_name} LIKE :column_name"), {"column_name": column_name})
            if rows.first():
                return
        connection.execute(text(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {definition}"))


def migrate_existing_database():
    add_column_if_missing("requests", "image_url", "TEXT")
    add_column_if_missing("requests", "image_verification_status", "VARCHAR(40) NOT NULL DEFAULT 'not_submitted'")
    add_column_if_missing("requests", "image_verification_reason", "TEXT")
    add_column_if_missing("requests", "severity_support_points", "INTEGER NOT NULL DEFAULT 0")


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(bind=engine)
    migrate_existing_database()
    seed_data()
    yield


app = FastAPI(title="DisasterIQ API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def health():
    return {"message": "DisasterIQ backend online", "mock_mode": config.USE_MOCK_DATA}


@app.post("/login", response_model=schemas.UserRead)
def login(payload: schemas.LoginPayload, db: Session = Depends(get_db)):
    return login_user(payload, db)


app.include_router(requests.router)
app.include_router(assignments.router)
app.include_router(users.router)
