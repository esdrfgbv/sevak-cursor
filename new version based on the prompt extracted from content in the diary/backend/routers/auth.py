from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from .. import models, schemas


def login_user(payload: schemas.LoginPayload, db: Session):
    user = db.scalar(
        select(models.User)
        .options(selectinload(models.User.skills))
        .where(models.User.name == payload.name)
    )
    if not user:
        user = models.User(
            name=payload.name,
            role=payload.role,
            phone=payload.phone,
            lat=payload.lat,
            lng=payload.lng,
            availability=payload.role == "volunteer",
            status="available" if payload.role == "volunteer" else "available",
        )
        db.add(user)
        db.flush()

    user.phone = payload.phone or user.phone
    user.role = payload.role
    user.lat = payload.lat
    user.lng = payload.lng
    if payload.role == "volunteer" and user.status in {"available", "completed"}:
        user.availability = True
    elif payload.role != "volunteer":
        user.availability = False

    if payload.role == "volunteer":
        skills = []
        for skill_name in payload.skills:
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
