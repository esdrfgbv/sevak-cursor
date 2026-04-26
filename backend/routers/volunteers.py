from fastapi import APIRouter, HTTPException

import models
import schemas
from firebase_service import (
    ensure_skills,
    get_assignments,
    get_user_by_id,
    get_users,
    update_user,
)
from models import assignment_from_dict, user_from_dict
from services.cluster_service import haversine_km
from services.state_manager import update_volunteer_status

router = APIRouter(prefix="/api/volunteers", tags=["volunteers"])


@router.get("/search", response_model=list[schemas.UserRead])
def search_volunteers(
    skill: str | None = None,
    available: bool | None = None,
    lat: float | None = None,
    lng: float | None = None,
    radius_km: float = 10,
):
    volunteers_dict = get_users(role="volunteer")
    
    volunteers = [user_from_dict(v) for v in volunteers_dict]
    if available is not None:
        volunteers = [v for v in volunteers if v.availability == available]

    volunteers.sort(key=lambda x: x.rating, reverse=True)

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
def get_volunteer(volunteer_id: int):
    vol_dict = get_user_by_id(volunteer_id)
    if not vol_dict or vol_dict.get("role") != "volunteer":
        raise HTTPException(status_code=404, detail="Volunteer not found")
    return user_from_dict(vol_dict)


@router.put("/{volunteer_id}", response_model=schemas.UserRead)
def update_volunteer(volunteer_id: int, payload: schemas.VolunteerUpdate):
    vol_dict = get_user_by_id(volunteer_id)
    if not vol_dict or vol_dict.get("role") != "volunteer":
        raise HTTPException(status_code=404, detail="Volunteer not found")

    volunteer = user_from_dict(vol_dict)
    updates = {}
    
    if payload.name is not None:
        updates["name"] = payload.name
    if payload.phone is not None:
        updates["phone"] = payload.phone
    if payload.lat is not None:
        updates["lat"] = payload.lat
    if payload.lng is not None:
        updates["lng"] = payload.lng
    if payload.availability is not None:
        updates["availability"] = payload.availability

    if payload.status is not None:
        try:
            update_volunteer_status(volunteer, payload.status, payload.availability)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
            
    if updates:
        update_user(volunteer_id, updates)

    return user_from_dict(get_user_by_id(volunteer_id))


@router.put("/{volunteer_id}/location", response_model=schemas.UserRead)
def update_volunteer_location(volunteer_id: int, payload: schemas.VolunteerLocationUpdate):
    vol_dict = get_user_by_id(volunteer_id)
    if not vol_dict or vol_dict.get("role") != "volunteer":
        raise HTTPException(status_code=404, detail="Volunteer not found")

    update_user(volunteer_id, {"lat": payload.lat, "lng": payload.lng})
    return user_from_dict(get_user_by_id(volunteer_id))


@router.post("/{volunteer_id}/skills", response_model=schemas.UserRead)
def update_volunteer_skills(volunteer_id: int, payload: schemas.VolunteerSkillsUpdate):
    vol_dict = get_user_by_id(volunteer_id)
    if not vol_dict or vol_dict.get("role") != "volunteer":
        raise HTTPException(status_code=404, detail="Volunteer not found")

    ensure_skills(payload.skills)
    update_user(volunteer_id, {"skills": payload.skills})
    return user_from_dict(get_user_by_id(volunteer_id))


@router.get("/{volunteer_id}/assignments", response_model=list[schemas.AssignmentRead])
def get_volunteer_assignments(volunteer_id: int):
    assignments = [assignment_from_dict(a) for a in get_assignments(volunteer_id=volunteer_id)]
    assignments.sort(key=lambda x: x.created_at, reverse=True)
    return assignments
