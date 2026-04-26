from fastapi import APIRouter, HTTPException

from .. import schemas
from ..firebase_service import (
    create_assignment,
    get_assignment_by_id,
    get_request_by_id,
    get_user_by_id,
    update_assignment,
    update_user,
    create_rating,
    get_rating_by_assignment,
    get_ratings_for_volunteer,
)
from ..models import assignment_from_dict, request_from_dict, user_from_dict, rating_from_dict
from ..services.assignment_engine import reassign_request, score_volunteer_for_request
from ..services.state_manager import ASSIGNMENT_TO_VOLUNTEER, update_request_status, update_volunteer_status

router = APIRouter(prefix="/api/assignments", tags=["assignments"])


@router.post("", response_model=schemas.AssignmentRead)
def create_assignment_endpoint(payload: schemas.AssignmentCreate):
    req_dict = get_request_by_id(payload.task_id)
    if not req_dict:
        raise HTTPException(status_code=404, detail="Task not found")
    request_obj = request_from_dict(req_dict)

    vol_dict = get_user_by_id(payload.volunteer_id)
    if not vol_dict or vol_dict.get("role") != "volunteer":
        raise HTTPException(status_code=404, detail="Volunteer not found")
    volunteer = user_from_dict(vol_dict)

    existing = next((item for item in request_obj.assignments if item.volunteer_id == volunteer.id), None)
    if existing:
        raise HTTPException(status_code=400, detail="Volunteer already assigned to this task")

    score, reason = score_volunteer_for_request(request_obj, volunteer)
    mode = (request_obj.mode or "DISASTER").upper()

    initial_status = "pending_acceptance" if mode == "NGO" else "accepted"

    assignment_data = {
        "request_id": payload.task_id,
        "volunteer_id": payload.volunteer_id,
        "score": score,
        "status": initial_status,
        "reason": f"{reason}; manually assigned",
    }
    assignment_dict = create_assignment(assignment_data)
    assignment_id = assignment_dict["id"]

    if initial_status == "accepted":
        update_volunteer_status(volunteer, "assigned", availability=False)

    update_request_status(payload.task_id)

    return assignment_from_dict(get_assignment_by_id(assignment_id))


@router.put("/{assignment_id}/accept", response_model=schemas.AssignmentRead)
def accept_assignment(assignment_id: int):
    assign_dict = get_assignment_by_id(assignment_id)
    if not assign_dict:
        raise HTTPException(status_code=404, detail="Assignment not found")
        
    assignment = assignment_from_dict(assign_dict)

    if assignment.status not in ("pending_acceptance",):
        raise HTTPException(status_code=400, detail=f"Cannot accept assignment in status: {assignment.status}")

    update_assignment(assignment_id, {"status": "accepted"})
    update_volunteer_status(assignment.volunteer, "assigned", availability=False)
    update_request_status(assignment.request_id)
    
    return assignment_from_dict(get_assignment_by_id(assignment_id))


@router.put("/{assignment_id}/decline", response_model=schemas.AssignmentRead)
def decline_assignment(assignment_id: int):
    assign_dict = get_assignment_by_id(assignment_id)
    if not assign_dict:
        raise HTTPException(status_code=404, detail="Assignment not found")
        
    assignment = assignment_from_dict(assign_dict)

    if assignment.status not in ("pending_acceptance",):
        raise HTTPException(status_code=400, detail=f"Cannot decline assignment in status: {assignment.status}")

    update_assignment(assignment_id, {"status": "declined"})
    update_volunteer_status(assignment.volunteer, "available", availability=True)
    update_request_status(assignment.request_id)
    
    return assignment_from_dict(get_assignment_by_id(assignment_id))


@router.put("/{assignment_id}/complete", response_model=schemas.AssignmentRead)
def complete_assignment(assignment_id: int):
    assign_dict = get_assignment_by_id(assignment_id)
    if not assign_dict:
        raise HTTPException(status_code=404, detail="Assignment not found")
        
    assignment = assignment_from_dict(assign_dict)

    if assignment.status in ("completed", "declined"):
        raise HTTPException(status_code=400, detail=f"Assignment already in terminal status: {assignment.status}")

    update_assignment(assignment_id, {"status": "completed"})
    
    volunteer = assignment.volunteer
    if volunteer:
        update_user(volunteer.id, {
            "status": "available",
            "availability": True,
            "workload": max(0, volunteer.workload - 1)
        })
        
    update_request_status(assignment.request_id)
    
    return assignment_from_dict(get_assignment_by_id(assignment_id))


@router.put("/{assignment_id}/status", response_model=schemas.AssignmentRead)
def update_assignment_status_endpoint(assignment_id: int, payload: schemas.AssignmentStatusUpdate):
    assign_dict = get_assignment_by_id(assignment_id)
    if not assign_dict:
        raise HTTPException(status_code=404, detail="Assignment not found")
        
    assignment = assignment_from_dict(assign_dict)
    update_assignment(assignment_id, {"status": payload.status})

    volunteer_status = ASSIGNMENT_TO_VOLUNTEER.get(payload.status)
    if volunteer_status and assignment.volunteer:
        try:
            update_volunteer_status(assignment.volunteer, volunteer_status)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    if payload.status in {"declined", "timed_out"}:
        req_dict = get_request_by_id(assignment.request_id)
        if req_dict:
            request_obj = request_from_dict(req_dict)
            excluded = {item.volunteer_id for item in request_obj.assignments}
            reassign_request(assignment.request_id, excluded)

    update_request_status(assignment.request_id)
    
    return assignment_from_dict(get_assignment_by_id(assignment_id))


@router.post("/{assignment_id}/rate", response_model=schemas.RatingRead)
def rate_assignment(assignment_id: int, payload: schemas.RatingCreate):
    assign_dict = get_assignment_by_id(assignment_id)
    if not assign_dict:
        raise HTTPException(status_code=404, detail="Assignment not found")
        
    assignment = assignment_from_dict(assign_dict)

    if assignment.status != "completed":
        raise HTTPException(status_code=400, detail="Can only rate completed assignments")

    existing = get_rating_by_assignment(assignment_id)
    if existing:
        raise HTTPException(status_code=400, detail="Assignment already rated")

    rating_data = {
        "assignment_id": assignment_id,
        "rating": payload.rating,
        "comment": payload.comment,
    }
    rating_dict = create_rating(rating_data)

    volunteer = assignment.volunteer
    if volunteer:
        all_ratings = get_ratings_for_volunteer(volunteer.id)
        total = sum(r.get("rating", 0) for r in all_ratings)
        count = len(all_ratings)
        avg_rating = round(total / count, 2) if count > 0 else 0
        update_user(volunteer.id, {"rating": avg_rating})

    return rating_from_dict(rating_dict)
