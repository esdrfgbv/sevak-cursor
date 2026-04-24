"""Volunteers router with /api/volunteers/ prefix."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import and_, select
from sqlalchemy.orm import Session, selectinload

from .. import models, schemas
from ..database import get_db
from ..services.cluster_service import haversine_km
from ..services.state_manager import update_volunteer_status

router = APIRouter(prefix="/api/volunteers", tags=["volunteers"])


@router.get("/search", response_model=list[schemas.UserRead])
def search_volunteers(
    skill: str | None = None,
    available: bool | None = None,
    lat: float | None = None,
    lng: float | None = None,
    radius_km: float = 10,
    db: Session = Depends(get_db),
):
    query = (
        select(models.User)
        .options(selectinload(models.User.skills))
        .where(models.User.role == "volunteer")
    )
    if available is not None:
        query = query.where(models.User.availability == available)

    volunteers = db.scalars(query.order_by(models.User.rating.desc())).all()

    results = []
    for vol in volunteers:
        if skill:
            vol_skills = {s.name.lower() for s in vol.skills}
            if skill.lower() not in vol_skills:
                continue
        if lat is not None and lng is not None:
            dist = haversine_km(lat, lng, vol.lat, vol.lng)
            if dist > radius_km:
                continue
        results.append(vol)

    return results


@router.get("/{volunteer_id}", response_model=schemas.UserRead)
def get_volunteer(volunteer_id: int, db: Session = Depends(get_db)):
    volunteer = db.scalar(
        select(models.User)
        .options(selectinload(models.User.skills))
        .where(models.User.id == volunteer_id, models.User.role == "volunteer")
    )
    if not volunteer:
        raise HTTPException(status_code=404, detail="Volunteer not found")
    return volunteer


@router.put("/{volunteer_id}", response_model=schemas.UserRead)
def update_volunteer(volunteer_id: int, payload: schemas.VolunteerUpdate, db: Session = Depends(get_db)):
    volunteer = db.scalar(
        select(models.User)
        .options(selectinload(models.User.skills))
        .where(models.User.id == volunteer_id, models.User.role == "volunteer")
    )
    if not volunteer:
        raise HTTPException(status_code=404, detail="Volunteer not found")

    if payload.name is not None:
        volunteer.name = payload.name
    if payload.phone is not None:
        volunteer.phone = payload.phone
    if payload.lat is not None:
        volunteer.lat = payload.lat
    if payload.lng is not None:
        volunteer.lng = payload.lng
    if payload.availability is not None:
        volunteer.availability = payload.availability
    if payload.status is not None:
        try:
            update_volunteer_status(volunteer, payload.status, payload.availability)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    db.add(volunteer)
    db.commit()
    db.refresh(volunteer)
    return volunteer


@router.post("/{volunteer_id}/skills", response_model=schemas.UserRead)
def update_volunteer_skills(volunteer_id: int, payload: schemas.VolunteerSkillsUpdate, db: Session = Depends(get_db)):
    volunteer = db.scalar(
        select(models.User)
        .options(selectinload(models.User.skills))
        .where(models.User.id == volunteer_id, models.User.role == "volunteer")
    )
    if not volunteer:
        raise HTTPException(status_code=404, detail="Volunteer not found")

    skills = []
    for skill_name in payload.skills:
        skill = db.scalar(select(models.Skill).where(models.Skill.name == skill_name))
        if not skill:
            skill = models.Skill(name=skill_name)
            db.add(skill)
            db.flush()
        skills.append(skill)
    volunteer.skills = skills
    db.add(volunteer)
    db.commit()
    db.refresh(volunteer)
    return volunteer


@router.get("/{volunteer_id}/assignments", response_model=list[schemas.AssignmentRead])
def get_volunteer_assignments(volunteer_id: int, db: Session = Depends(get_db)):
    assignments = db.scalars(
        select(models.Assignment)
        .options(
            selectinload(models.Assignment.request).selectinload(models.Request.skills),
            selectinload(models.Assignment.volunteer).selectinload(models.User.skills),
        )
        .where(models.Assignment.volunteer_id == volunteer_id)
        .order_by(models.Assignment.created_at.desc())
    ).all()
    return assignments
