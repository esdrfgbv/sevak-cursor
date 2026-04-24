from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from .. import models, schemas
from ..database import get_db
from ..services.cluster_service import haversine_km
from ..services.state_manager import update_request_status, update_volunteer_status

router = APIRouter()


def _nearby_requests_for_user(db: Session, user: models.User, radius_km: float, exclude_requester_id: int | None = None):
    requests = db.scalars(
        select(models.Request)
        .options(
            selectinload(models.Request.skills),
            selectinload(models.Request.assignments).selectinload(models.Assignment.volunteer).selectinload(models.User.skills),
            selectinload(models.Request.support_votes),
        )
        .where(models.Request.status != "completed")
        .order_by(models.Request.priority_score.desc(), models.Request.created_at.desc())
    ).all()

    nearby = []
    for request_obj in requests:
        if exclude_requester_id and request_obj.requester_id == exclude_requester_id:
            continue
        distance_km = haversine_km(user.lat, user.lng, request_obj.lat, request_obj.lng)
        if distance_km <= radius_km:
            nearby.append({
                **schemas.RequestDetail.model_validate(request_obj, from_attributes=True).model_dump(),
                "distance_km": round(distance_km, 2),
                "supported_by_me": any(vote.requester_id == user.id for vote in request_obj.support_votes),
            })
    return nearby


@router.get("/volunteer/{volunteer_id}/tasks", response_model=list[schemas.AssignmentRead])
def volunteer_tasks(volunteer_id: int, db: Session = Depends(get_db)):
    assignments = db.scalars(
        select(models.Assignment)
        .options(selectinload(models.Assignment.request).selectinload(models.Request.skills))
        .where(models.Assignment.volunteer_id == volunteer_id)
        .order_by(models.Assignment.created_at.desc())
    ).all()
    return assignments


@router.put("/volunteer/{volunteer_id}/status", response_model=schemas.UserRead)
def update_volunteer(volunteer_id: int, payload: schemas.VolunteerStatusUpdate, db: Session = Depends(get_db)):
    volunteer = db.scalar(select(models.User).options(selectinload(models.User.skills)).where(models.User.id == volunteer_id))
    if not volunteer:
        raise HTTPException(status_code=404, detail="Volunteer not found")
    try:
        update_volunteer_status(volunteer, payload.status, payload.availability)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    db.add(volunteer)
    db.commit()
    db.refresh(volunteer)
    return volunteer


@router.put("/volunteer/{volunteer_id}/location", response_model=schemas.UserRead)
def update_volunteer_location(volunteer_id: int, payload: schemas.VolunteerLocationUpdate, db: Session = Depends(get_db)):
    volunteer = db.scalar(select(models.User).options(selectinload(models.User.skills)).where(models.User.id == volunteer_id))
    if not volunteer:
        raise HTTPException(status_code=404, detail="Volunteer not found")
    volunteer.lat = payload.lat
    volunteer.lng = payload.lng
    db.add(volunteer)
    db.commit()
    db.refresh(volunteer)
    return volunteer


@router.put("/requester/{requester_id}/location", response_model=schemas.UserRead)
def update_requester_location(requester_id: int, payload: schemas.VolunteerLocationUpdate, db: Session = Depends(get_db)):
    requester = db.scalar(select(models.User).options(selectinload(models.User.skills)).where(models.User.id == requester_id))
    if not requester or requester.role != "requester":
        raise HTTPException(status_code=404, detail="Requester not found")
    requester.lat = payload.lat
    requester.lng = payload.lng
    db.add(requester)
    db.commit()
    db.refresh(requester)
    return requester


@router.get("/volunteer/{volunteer_id}/nearby-requests", response_model=list[schemas.NearbyRequestRead])
def nearby_requests_for_volunteer(volunteer_id: int, radius_km: float = 10, db: Session = Depends(get_db)):
    volunteer = db.scalar(select(models.User).where(models.User.id == volunteer_id, models.User.role == "volunteer"))
    if not volunteer:
        raise HTTPException(status_code=404, detail="Volunteer not found")
    return _nearby_requests_for_user(db, volunteer, radius_km=radius_km)


@router.get("/requester/{requester_id}/nearby-requests", response_model=list[schemas.NearbyRequestRead])
def nearby_requests_for_requester(requester_id: int, radius_km: float = 10, db: Session = Depends(get_db)):
    requester = db.scalar(select(models.User).where(models.User.id == requester_id, models.User.role == "requester"))
    if not requester:
        raise HTTPException(status_code=404, detail="Requester not found")
    return _nearby_requests_for_user(db, requester, radius_km=radius_km, exclude_requester_id=requester_id)


@router.get("/admin/overview", response_model=schemas.AdminOverview)
def admin_overview(db: Session = Depends(get_db)):
    requests = db.scalars(
        select(models.Request)
        .options(
            selectinload(models.Request.skills),
            selectinload(models.Request.assignments).selectinload(models.Assignment.volunteer).selectinload(models.User.skills),
            selectinload(models.Request.support_votes),
        )
        .order_by(models.Request.created_at.desc())
    ).all()
    volunteers = db.scalars(
        select(models.User).options(selectinload(models.User.skills)).where(models.User.role == "volunteer")
    ).all()
    for request_obj in requests:
        update_request_status(db, request_obj)
    db.commit()
    totals = {
        "requests_total": db.scalar(select(func.count(models.Request.id))) or 0,
        "requests_active": db.scalar(select(func.count(models.Request.id)).where(models.Request.status != "completed")) or 0,
        "requests_completed": db.scalar(select(func.count(models.Request.id)).where(models.Request.status == "completed")) or 0,
        "critical_cases": db.scalar(
            select(func.count(models.Request.id)).where(models.Request.priority_level.in_(["HIGH", "CRITICAL"]))
        )
        or 0,
        "available_volunteers": db.scalar(
            select(func.count(models.User.id)).where(models.User.role == "volunteer", models.User.status == "available")
        )
        or 0,
    }
    return {"totals": totals, "requests": requests, "volunteers": volunteers}
