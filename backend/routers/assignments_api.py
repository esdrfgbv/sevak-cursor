"""Assignments router with /api/assignments/ prefix."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.orm import Session, selectinload

from .. import models, schemas
from ..database import get_db
from ..services.assignment_engine import reassign_request
from ..services.state_manager import ASSIGNMENT_TO_VOLUNTEER, update_request_status, update_volunteer_status

router = APIRouter(prefix="/api/assignments", tags=["assignments"])


@router.post("", response_model=schemas.AssignmentRead)
def create_assignment(payload: schemas.AssignmentCreate, db: Session = Depends(get_db)):
    """Manually create an assignment (used in NGO mode)."""
    request_obj = db.scalar(
        select(models.Request)
        .options(selectinload(models.Request.skills), selectinload(models.Request.assignments))
        .where(models.Request.id == payload.task_id)
    )
    if not request_obj:
        raise HTTPException(status_code=404, detail="Task not found")

    volunteer = db.scalar(
        select(models.User)
        .options(selectinload(models.User.skills))
        .where(models.User.id == payload.volunteer_id, models.User.role == "volunteer")
    )
    if not volunteer:
        raise HTTPException(status_code=404, detail="Volunteer not found")

    # Check if already assigned
    existing = db.scalar(
        select(models.Assignment).where(
            models.Assignment.request_id == payload.task_id,
            models.Assignment.volunteer_id == payload.volunteer_id,
        )
    )
    if existing:
        raise HTTPException(status_code=400, detail="Volunteer already assigned to this task")

    from ..services.assignment_engine import score_volunteer_for_request

    score, reason = score_volunteer_for_request(request_obj, volunteer)
    mode = (request_obj.mode or "DISASTER").upper()

    # In NGO mode, assignment starts as pending_acceptance
    initial_status = "pending_acceptance" if mode == "NGO" else "accepted"

    assignment = models.Assignment(
        request_id=payload.task_id,
        volunteer_id=payload.volunteer_id,
        score=score,
        status=initial_status,
        reason=f"{reason}; manually assigned",
    )
    if initial_status == "accepted":
        update_volunteer_status(volunteer, "assigned", availability=False)
        db.add(volunteer)

    db.add(assignment)
    update_request_status(db, request_obj)
    db.commit()

    return db.scalar(
        select(models.Assignment)
        .options(selectinload(models.Assignment.volunteer).selectinload(models.User.skills))
        .where(models.Assignment.id == assignment.id)
    )


@router.put("/{assignment_id}/accept", response_model=schemas.AssignmentRead)
def accept_assignment(assignment_id: int, db: Session = Depends(get_db)):
    """Volunteer accepts an NGO assignment."""
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

    if assignment.status not in ("pending_acceptance",):
        raise HTTPException(status_code=400, detail=f"Cannot accept assignment in status: {assignment.status}")

    assignment.status = "accepted"
    update_volunteer_status(assignment.volunteer, "assigned", availability=False)
    db.add(assignment)
    db.add(assignment.volunteer)
    update_request_status(db, assignment.request)
    db.commit()
    db.refresh(assignment)
    return assignment


@router.put("/{assignment_id}/decline", response_model=schemas.AssignmentRead)
def decline_assignment(assignment_id: int, db: Session = Depends(get_db)):
    """Volunteer declines an NGO assignment."""
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

    if assignment.status not in ("pending_acceptance",):
        raise HTTPException(status_code=400, detail=f"Cannot decline assignment in status: {assignment.status}")

    assignment.status = "declined"
    update_volunteer_status(assignment.volunteer, "available", availability=True)
    db.add(assignment)
    db.add(assignment.volunteer)
    update_request_status(db, assignment.request)
    db.commit()
    db.refresh(assignment)
    return assignment


@router.put("/{assignment_id}/complete", response_model=schemas.AssignmentRead)
def complete_assignment(assignment_id: int, db: Session = Depends(get_db)):
    """Mark assignment as completed."""
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

    if assignment.status in ("completed", "declined"):
        raise HTTPException(status_code=400, detail=f"Assignment already in terminal status: {assignment.status}")

    assignment.status = "completed"
    volunteer = assignment.volunteer
    # Reset volunteer to available
    volunteer.status = "available"
    volunteer.availability = True
    volunteer.workload = max(0, volunteer.workload - 1)
    db.add(assignment)
    db.add(volunteer)
    update_request_status(db, assignment.request)
    db.commit()
    db.refresh(assignment)
    return assignment


@router.put("/{assignment_id}/status", response_model=schemas.AssignmentRead)
def update_assignment_status(assignment_id: int, payload: schemas.AssignmentStatusUpdate, db: Session = Depends(get_db)):
    """Generic status update for assignments."""
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


@router.post("/{assignment_id}/rate", response_model=schemas.RatingRead)
def rate_assignment(assignment_id: int, payload: schemas.RatingCreate, db: Session = Depends(get_db)):
    """Rate a completed assignment."""
    assignment = db.scalar(
        select(models.Assignment)
        .options(selectinload(models.Assignment.volunteer))
        .where(models.Assignment.id == assignment_id)
    )
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")

    if assignment.status != "completed":
        raise HTTPException(status_code=400, detail="Can only rate completed assignments")

    # Check for existing rating
    existing = db.scalar(
        select(models.Rating).where(models.Rating.assignment_id == assignment_id)
    )
    if existing:
        raise HTTPException(status_code=400, detail="Assignment already rated")

    rating_obj = models.Rating(
        assignment_id=assignment_id,
        rating=payload.rating,
        comment=payload.comment,
    )
    db.add(rating_obj)

    # Update volunteer's average rating
    volunteer = assignment.volunteer
    all_ratings = db.scalars(
        select(models.Rating).join(models.Assignment).where(
            models.Assignment.volunteer_id == volunteer.id
        )
    ).all()
    total = sum(r.rating for r in all_ratings) + payload.rating
    count = len(all_ratings) + 1
    volunteer.rating = round(total / count, 2)
    db.add(volunteer)

    db.commit()
    db.refresh(rating_obj)
    return rating_obj
