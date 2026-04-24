from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from .. import models, schemas
from ..database import get_db
from ..services.assignment_engine import reassign_request
from ..services.state_manager import ASSIGNMENT_TO_VOLUNTEER, update_request_status, update_volunteer_status

router = APIRouter()


@router.put("/assignments/{assignment_id}", response_model=schemas.AssignmentRead)
def update_assignment(assignment_id: int, payload: schemas.AssignmentStatusUpdate, db: Session = Depends(get_db)):
    assignment = db.scalar(
        select(models.Assignment)
        .options(
            selectinload(models.Assignment.volunteer).selectinload(models.User.skills),
            selectinload(models.Assignment.request).selectinload(models.Request.assignments),
        )
        .where(models.Assignment.id == assignment_id)
    )
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")

    assignment.status = payload.status
    volunteer_status = ASSIGNMENT_TO_VOLUNTEER.get(payload.status)
    if volunteer_status:
        try:
            update_volunteer_status(assignment.volunteer, volunteer_status)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        db.add(assignment.volunteer)

    db.add(assignment)

    if payload.status in {"declined", "timed_out"}:
        excluded = {item.volunteer_id for item in assignment.request.assignments}
        reassign_request(db, assignment.request_id, excluded)

    update_request_status(db, assignment.request)
    db.commit()
    db.refresh(assignment)
    return assignment
