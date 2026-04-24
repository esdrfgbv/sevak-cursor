"""Auth router with /api/auth/ prefix."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from .. import models, schemas
from ..database import get_db

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _upsert_user(payload, db: Session) -> models.User:
    user = db.scalar(
        select(models.User)
        .options(selectinload(models.User.skills))
        .where(models.User.name == payload.name)
    )
    if not user:
        user = models.User(
            name=payload.name,
            role=payload.role,
            phone=getattr(payload, "phone", None),
            lat=payload.lat,
            lng=payload.lng,
            availability=payload.role == "volunteer",
            status="available",
        )
        db.add(user)
        db.flush()

    user.phone = getattr(payload, "phone", None) or user.phone
    user.role = payload.role
    user.lat = payload.lat
    user.lng = payload.lng
    if payload.role == "volunteer" and user.status in {"available", "completed"}:
        user.availability = True
    elif payload.role != "volunteer":
        user.availability = False

    if payload.role == "volunteer":
        skills = []
        for skill_name in (payload.skills or []):
            skill = db.scalar(select(models.Skill).where(models.Skill.name == skill_name))
            if not skill:
                skill = models.Skill(name=skill_name)
                db.add(skill)
                db.flush()
            skills.append(skill)
        if skills:
            user.skills = skills

    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post("/register", response_model=schemas.AuthResponse)
def register(payload: schemas.RegisterPayload, db: Session = Depends(get_db)):
    existing = db.scalar(
        select(models.User).where(models.User.name == payload.name)
    )
    if existing:
        raise HTTPException(status_code=400, detail="User already exists. Please login.")
    user = _upsert_user(payload, db)
    token = f"sevak-token-{user.id}"
    return {"user": user, "token": token}


@router.post("/login", response_model=schemas.AuthResponse)
def login(payload: schemas.LoginPayload, db: Session = Depends(get_db)):
    user = _upsert_user(payload, db)
    token = f"sevak-token-{user.id}"
    return {"user": user, "token": token}
