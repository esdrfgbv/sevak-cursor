from fastapi import APIRouter, HTTPException

import schemas
from firebase_service import (
    get_assignment_by_id,
    get_request_by_id,
    update_assignment,
)
from models import assignment_from_dict, request_from_dict
from services.assignment_engine import reassign_request
from services.state_manager import ASSIGNMENT_TO_VOLUNTEER, update_request_status, update_volunteer_status

router = APIRouter()


@router.put("/assignments/{assignment_id}", response_model=schemas.AssignmentRead)
def update_assignment_endpoint(assignment_id: int, payload: schemas.AssignmentStatusUpdate):
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
