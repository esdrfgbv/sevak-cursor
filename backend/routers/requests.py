from fastapi import APIRouter, HTTPException

from .. import models, schemas
from ..firebase_service import (
    create_assignment,
    create_request,
    ensure_skills,
    get_request_by_id,
    get_requests,
    get_support_votes,
    add_support_vote,
    update_assignment,
    update_request,
    get_user_by_id,
)
from ..models import request_from_dict, user_from_dict, assignment_from_dict
from ..services.assignment_engine import run_assignment, score_volunteer_for_request
from ..services.cluster_service import cluster_metrics_for_request, haversine_km
from ..services.incident_matching import duplicate_signal_points, find_duplicate_request
from ..services.priority_engine import calculate_priority
from ..services.state_manager import update_request_status, update_volunteer_status
from ..services.vision_pipeline import analyze_incident_image

router = APIRouter()


@router.post("/requests", response_model=schemas.RequestCreateResponse)
def create_request_endpoint(payload: schemas.RequestCreate):
    ensure_skills(payload.required_skills)

    cluster_boost, _cluster_size = cluster_metrics_for_request(payload.lat, payload.lng)
    priority_score, priority_level = calculate_priority(
        payload.description,
        payload.people_count,
        payload.required_skills,
        cluster_boost,
    )

    image_status, image_reason, image_url, verification_payload = analyze_incident_image(
        image_data=payload.image_data,
        incident_type=payload.incident_type,
        description=payload.description,
    )
    verification = schemas.ImageVerificationSummary(**verification_payload)

    duplicate_request, _ = find_duplicate_request(payload)
    duplicate_points_added = 0

    if duplicate_request:
        duplicate_points_added = duplicate_signal_points(payload, cluster_boost)
        duplicate_request.severity_support_points += duplicate_points_added
        duplicate_priority_score, duplicate_priority_level = calculate_priority(
            duplicate_request.description,
            duplicate_request.people_count,
            [skill.name for skill in duplicate_request.skills],
            duplicate_request.cluster_boost + duplicate_request.severity_support_points,
        )
        duplicate_request.priority_score = duplicate_priority_score
        duplicate_request.priority_level = duplicate_priority_level
        
        update_request(duplicate_request.id, {
            "severity_support_points": duplicate_request.severity_support_points,
            "priority_score": duplicate_request.priority_score,
            "priority_level": duplicate_request.priority_level
        })
        
        run_assignment(duplicate_request.id, {assignment.volunteer_id for assignment in duplicate_request.assignments})
        update_request_status(duplicate_request.id)
        
        priority_score = duplicate_priority_score
        priority_level = duplicate_priority_level

    req_data = {
        "requester_id": payload.requester_id,
        "incident_type": payload.incident_type,
        "title": payload.title,
        "description": payload.description,
        "lat": payload.lat,
        "lng": payload.lng,
        "people_count": payload.people_count,
        "priority_score": priority_score,
        "priority_level": priority_level,
        "cluster_boost": cluster_boost,
        "severity_support_points": duplicate_points_added,
        "image_url": image_url,
        "image_verification_status": image_status,
        "image_verification_reason": image_reason,
        "required_skills": payload.required_skills,
    }
    created = create_request(req_data)
    request_id = created["id"]
    
    run_assignment(request_id)
    update_request_status(request_id)
    
    request_detail = request_from_dict(get_request_by_id(request_id))
    
    duplicate_detail = None
    if duplicate_request:
        duplicate_detail = request_from_dict(get_request_by_id(duplicate_request.id))
        
    suggested = list(request_detail.assignments) if request_detail else []
    return {
        "request": request_detail,
        "assigned_count": len(suggested),
        "suggested_volunteers": suggested,
        "duplicate_detected": duplicate_request is not None,
        "duplicate_points_added": duplicate_points_added,
        "duplicate_request": duplicate_detail,
        "verification": verification,
    }


@router.get("/requests", response_model=list[schemas.RequestDetail])
def list_requests():
    requests = [request_from_dict(d) for d in get_requests(include_assignments=True, include_support_votes=True)]
    return requests


@router.get("/requests/{request_id}", response_model=schemas.RequestDetail)
def get_request(request_id: int):
    req_dict = get_request_by_id(request_id)
    if not req_dict:
        raise HTTPException(status_code=404, detail="Request not found")
    return request_from_dict(req_dict)


@router.post("/requests/{request_id}/claim", response_model=schemas.AssignmentRead)
def claim_request(request_id: int, payload: schemas.RequestClaimCreate):
    req_dict = get_request_by_id(request_id)
    if not req_dict:
        raise HTTPException(status_code=404, detail="Request not found")
    request_obj = request_from_dict(req_dict)
    
    if request_obj.status == "completed":
        raise HTTPException(status_code=400, detail="Completed requests cannot be claimed")

    vol_dict = get_user_by_id(payload.volunteer_id)
    if not vol_dict or vol_dict.get("role") != "volunteer":
        raise HTTPException(status_code=404, detail="Volunteer not found")
    volunteer = user_from_dict(vol_dict)

    distance_km = haversine_km(request_obj.lat, request_obj.lng, volunteer.lat, volunteer.lng)
    if distance_km > 10:
        raise HTTPException(status_code=400, detail="Volunteer is too far from this request")

    existing = next((item for item in request_obj.assignments if item.volunteer_id == volunteer.id), None)
    if existing:
        update_assignment(existing.id, {"status": "accepted"})
        update_volunteer_status(volunteer, "assigned", availability=False)
        update_request_status(request_obj.id)
        
        # Refresh and return
        updated_req = request_from_dict(get_request_by_id(request_id))
        return next((item for item in updated_req.assignments if item.id == existing.id), None)

    score, reason = score_volunteer_for_request(request_obj, volunteer)
    assignment_data = {
        "request_id": request_obj.id,
        "volunteer_id": volunteer.id,
        "score": score,
        "reason": f"{reason}; self-claimed nearby request",
        "status": "accepted",
    }
    assignment_dict = create_assignment(assignment_data)
    update_volunteer_status(volunteer, "assigned", availability=False)
    update_request_status(request_obj.id)

    return assignment_from_dict(assignment_dict)


@router.post("/requests/{request_id}/support", response_model=schemas.RequestDetail)
def support_request(request_id: int, payload: schemas.RequestSupportCreate):
    req_dict = get_request_by_id(request_id)
    if not req_dict:
        raise HTTPException(status_code=404, detail="Request not found")
    request_obj = request_from_dict(req_dict)
    
    if request_obj.status == "completed":
        raise HTTPException(status_code=400, detail="Completed requests cannot be supported")
    if request_obj.requester_id == payload.requester_id:
        raise HTTPException(status_code=400, detail="You cannot support your own request")

    req_user_dict = get_user_by_id(payload.requester_id)
    if not req_user_dict or req_user_dict.get("role") != "requester":
        raise HTTPException(status_code=404, detail="Requester not found")
    requester = user_from_dict(req_user_dict)

    distance_km = haversine_km(request_obj.lat, request_obj.lng, requester.lat, requester.lng)
    if distance_km > 10:
        raise HTTPException(status_code=400, detail="Requester is too far from this request")

    if not add_support_vote(request_id, payload.requester_id, max(payload.points, 1)):
        raise HTTPException(status_code=400, detail="Severity already supported from this account")

    # Refresh points
    support_votes = get_support_votes(request_id)
    total_points = sum(v.get("points", 0) for v in support_votes)
    
    request_obj.severity_support_points = total_points
    priority_score, priority_level = calculate_priority(
        request_obj.description,
        request_obj.people_count,
        [skill.name for skill in request_obj.skills],
        request_obj.cluster_boost + request_obj.severity_support_points,
    )
    
    update_request(request_id, {
        "severity_support_points": total_points,
        "priority_score": priority_score,
        "priority_level": priority_level
    })
    
    run_assignment(request_id, {assignment.volunteer_id for assignment in request_obj.assignments})
    update_request_status(request_id)

    return request_from_dict(get_request_by_id(request_id))


@router.put("/requests/{request_id}/resolve", response_model=schemas.RequestDetail)
def resolve_request(request_id: int, payload: schemas.RequestResolvePayload):
    req_dict = get_request_by_id(request_id)
    if not req_dict:
        raise HTTPException(status_code=404, detail="Request not found")
    request_obj = request_from_dict(req_dict)
    
    if request_obj.requester_id != payload.requester_id:
        raise HTTPException(status_code=403, detail="Only the original requester can resolve this incident")

    for assignment in request_obj.assignments:
        if assignment.status != "completed":
            update_assignment(assignment.id, {"status": "completed"})
        if assignment.volunteer:
            update_volunteer_status(assignment.volunteer, "completed")
            update_volunteer_status(assignment.volunteer, "available", availability=True)

    update_request(request_id, {"status": "completed"})

    return request_from_dict(get_request_by_id(request_id))
