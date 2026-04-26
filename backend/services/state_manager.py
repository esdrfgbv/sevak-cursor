"""State manager — works with dataclass models (no DB session needed)."""
from __future__ import annotations

from .. import firebase_service

VOLUNTEER_TRANSITIONS = {
    "available": {"assigned"},
    "assigned": {"available", "en_route", "completed"},
    "en_route": {"on_task", "available", "assigned"},
    "on_task": {"completed", "available", "assigned"},
    "completed": {"available", "assigned"},
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


def update_request_status(request_id: int) -> str:
    """Recompute and persist request status from assignments."""
    return firebase_service.sync_request_status(request_id)


def update_volunteer_status(volunteer, new_status: str, availability: bool | None = None):
    """Validate transition and persist to Firebase.
    volunteer can be a dataclass User or a dict.
    """
    if isinstance(volunteer, dict):
        current = volunteer.get("status", "available")
        vol_id = volunteer.get("id")
    else:
        current = volunteer.status
        vol_id = volunteer.id

    if new_status != current and new_status not in VOLUNTEER_TRANSITIONS.get(current, set()):
        if not (current == "assigned" and new_status == "completed"):
            raise ValueError(f"Invalid volunteer state transition: {current} -> {new_status}")

    if availability is None:
        availability = new_status in {"available", "completed"}

    firebase_service.update_user(vol_id, {"status": new_status, "availability": availability})

    # Also update the in-memory object if it's a dataclass
    if not isinstance(volunteer, dict):
        volunteer.status = new_status
        volunteer.availability = availability

    return volunteer
