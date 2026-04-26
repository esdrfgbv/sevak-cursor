from fastapi import APIRouter, HTTPException

from .. import models, schemas
from ..firebase_service import (
    get_assignments,
    get_requests,
    get_user_by_id,
    get_users,
    update_request,
    update_user,
)
from ..models import assignment_from_dict, request_from_dict, user_from_dict
from ..services.cluster_service import haversine_km
from ..services.state_manager import update_request_status, update_volunteer_status

router = APIRouter()


def _nearby_requests_for_user(user: models.User, radius_km: float, exclude_requester_id: int | None = None):
    request_dicts = get_requests(include_support_votes=True)
    nearby = []
    
    for req_dict in request_dicts:
        if req_dict.get("status") == "completed":
            continue
        if exclude_requester_id and req_dict.get("requester_id") == exclude_requester_id:
            continue
            
        request_obj = request_from_dict(req_dict)
        distance_km = haversine_km(user.lat, user.lng, request_obj.lat, request_obj.lng)
        
        if distance_km <= radius_km:
            supported = any(vote.requester_id == user.id for vote in request_obj.support_votes)
            detail_dict = schemas.RequestDetail.model_validate(request_obj, from_attributes=True).model_dump()
            nearby.append({
                **detail_dict,
                "distance_km": round(distance_km, 2),
                "supported_by_me": supported,
            })
            
    # Sort by priority score desc, created at desc
    nearby.sort(key=lambda x: (x.get("priority_score", 0), x.get("created_at")), reverse=True)
    return nearby


@router.get("/volunteer/{volunteer_id}/tasks", response_model=list[schemas.AssignmentRead])
def volunteer_tasks(volunteer_id: int):
    assignments = [assignment_from_dict(a) for a in get_assignments(volunteer_id=volunteer_id)]
    assignments.sort(key=lambda x: x.created_at, reverse=True)
    return assignments


@router.put("/volunteer/{volunteer_id}/status", response_model=schemas.UserRead)
def update_volunteer(volunteer_id: int, payload: schemas.VolunteerStatusUpdate):
    user_dict = get_user_by_id(volunteer_id)
    if not user_dict or user_dict.get("role") != "volunteer":
        raise HTTPException(status_code=404, detail="Volunteer not found")
        
    volunteer = user_from_dict(user_dict)
    try:
        update_volunteer_status(volunteer, payload.status, payload.availability)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
        
    return user_from_dict(get_user_by_id(volunteer_id))


@router.put("/volunteer/{volunteer_id}/location", response_model=schemas.UserRead)
def update_volunteer_location(volunteer_id: int, payload: schemas.VolunteerLocationUpdate):
    user_dict = get_user_by_id(volunteer_id)
    if not user_dict or user_dict.get("role") != "volunteer":
        raise HTTPException(status_code=404, detail="Volunteer not found")
        
    update_user(volunteer_id, {"lat": payload.lat, "lng": payload.lng})
    return user_from_dict(get_user_by_id(volunteer_id))


@router.put("/requester/{requester_id}/location", response_model=schemas.UserRead)
def update_requester_location(requester_id: int, payload: schemas.VolunteerLocationUpdate):
    user_dict = get_user_by_id(requester_id)
    if not user_dict or user_dict.get("role") != "requester":
        raise HTTPException(status_code=404, detail="Requester not found")
        
    update_user(requester_id, {"lat": payload.lat, "lng": payload.lng})
    return user_from_dict(get_user_by_id(requester_id))


@router.put("/api/users/{user_id}/location", response_model=schemas.UserRead)
def update_user_location(user_id: int, payload: schemas.VolunteerLocationUpdate):
    user_dict = get_user_by_id(user_id)
    if not user_dict:
        raise HTTPException(status_code=404, detail="User not found")
        
    update_user(user_id, {"lat": payload.lat, "lng": payload.lng})
    return user_from_dict(get_user_by_id(user_id))


@router.get("/volunteer/{volunteer_id}/nearby-requests", response_model=list[schemas.NearbyRequestRead])
def nearby_requests_for_volunteer(volunteer_id: int, radius_km: float = 10):
    user_dict = get_user_by_id(volunteer_id)
    if not user_dict or user_dict.get("role") != "volunteer":
        raise HTTPException(status_code=404, detail="Volunteer not found")
        
    volunteer = user_from_dict(user_dict)
    return _nearby_requests_for_user(volunteer, radius_km=radius_km)


@router.get("/requester/{requester_id}/nearby-requests", response_model=list[schemas.NearbyRequestRead])
def nearby_requests_for_requester(requester_id: int, radius_km: float = 10):
    user_dict = get_user_by_id(requester_id)
    if not user_dict or user_dict.get("role") != "requester":
        raise HTTPException(status_code=404, detail="Requester not found")
        
    requester = user_from_dict(user_dict)
    return _nearby_requests_for_user(requester, radius_km=radius_km, exclude_requester_id=requester_id)


@router.get("/admin/overview", response_model=schemas.AdminOverview)
def admin_overview():
    try:
        from ..firebase_service import get_all_assignments, get_all_support_votes
        
        # 1. Fetch everything in bulk
        raw_requests = get_requests(include_assignments=False, include_support_votes=False)
        all_assignments = get_all_assignments(include_volunteer=True)
        all_votes = get_all_support_votes()
        volunteers = [user_from_dict(v) for v in get_users(role="volunteer")]

        # 2. Group assignments and votes by request_id
        assignments_map = {}
        for a in all_assignments:
            rid = str(a.get("request_id"))
            if rid not in assignments_map:
                assignments_map[rid] = []
            assignments_map[rid].append(a)
            
        votes_map = {}
        for v in all_votes:
            rid = str(v.get("request_id"))
            if rid not in votes_map:
                votes_map[rid] = []
            votes_map[rid].append(v)

        # 3. Attach sub-data to requests
        for r in raw_requests:
            rid = str(r.get("id"))
            r["assignments"] = assignments_map.get(rid, [])
            r["support_votes"] = votes_map.get(rid, [])

        requests = [request_from_dict(r) for r in raw_requests]
        requests.sort(key=lambda x: x.created_at, reverse=True)
        
        requests_active = sum(1 for r in requests if r.status != "completed")
        requests_completed = sum(1 for r in requests if r.status == "completed")
        critical_cases = sum(1 for r in requests if r.priority_level in ["HIGH", "CRITICAL"])
        available_vols = sum(1 for v in volunteers if v.status == "available")

        totals = {
            "requests_total": len(requests),
            "requests_active": requests_active,
            "requests_completed": requests_completed,
            "critical_cases": critical_cases,
            "available_volunteers": available_vols,
        }
        
        return {"totals": totals, "requests": requests, "volunteers": volunteers}
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
