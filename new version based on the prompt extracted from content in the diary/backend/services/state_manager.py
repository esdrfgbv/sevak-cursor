from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Assignment, Request, User

REQUEST_TRANSITIONS = {
    "pending": {"assigned", "completed"},
    "assigned": {"completed"},
    "completed": set(),
}

VOLUNTEER_TRANSITIONS = {
    "available": {"assigned"},
    "assigned": {"available", "en_route"},
    "en_route": {"on_task", "available"},
    "on_task": {"completed", "available"},
    "completed": {"available"},
}

ASSIGNMENT_TO_VOLUNTEER = {
    "pending_acceptance": "assigned",
    "accepted": "assigned",
    "declined": "available",
    "timed_out": "available",
    "en_route": "en_route",
    "on_task": "on_task",
    "completed": "completed",
}


def update_request_status(db: Session, request_obj: Request) -> Request:
    if request_obj.status == "completed":
        db.add(request_obj)
        return request_obj

    active_assignments = db.scalars(
        select(Assignment).where(
            Assignment.request_id == request_obj.id,
            Assignment.status.in_(["pending_acceptance", "accepted", "en_route", "on_task"]),
        )
    ).all()
    completed_assignments = db.scalars(
        select(Assignment).where(Assignment.request_id == request_obj.id, Assignment.status == "completed")
    ).all()

    if completed_assignments and not active_assignments:
        request_obj.status = "completed"
    elif active_assignments:
        request_obj.status = "assigned"
    else:
        request_obj.status = "pending"
    db.add(request_obj)
    return request_obj


def update_volunteer_status(volunteer: User, new_status: str, availability: bool | None = None) -> User:
    current = volunteer.status
    if new_status != current and new_status not in VOLUNTEER_TRANSITIONS.get(current, set()):
        if not (current == "assigned" and new_status == "completed"):
            raise ValueError(f"Invalid volunteer state transition: {current} -> {new_status}")
    volunteer.status = new_status
    if availability is not None:
        volunteer.availability = availability
    elif new_status in {"available", "completed"}:
        volunteer.availability = True
    else:
        volunteer.availability = False
    return volunteer
