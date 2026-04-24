from sqlalchemy import and_, func, select
from sqlalchemy.orm import Session, selectinload

from .. import config, mock_data
from ..models import Assignment, Request, User
from .cluster_service import cluster_metrics_for_request, haversine_km
from .priority_engine import allocation_count
from .state_manager import update_request_status, update_volunteer_status


def _distance_score(distance_km: float) -> float:
    if distance_km < 2:
        return 1.0
    if distance_km < 5:
        return 0.7
    if distance_km < 10:
        return 0.4
    return 0.1


def _skill_score(request_skills: set[str], volunteer_skills: set[str]) -> float:
    if not request_skills:
        return 1.0
    matches = len(request_skills.intersection(volunteer_skills))
    if matches == len(request_skills):
        return 1.0
    if matches > 0:
        return matches / len(request_skills)
    return 0.0


def _availability_score(volunteer: User) -> float:
    if volunteer.availability and volunteer.status == "available":
        return 1.0
    if volunteer.status in ("available",):
        return 0.5
    return 0.0


def _rating_score(volunteer: User) -> float:
    r = volunteer.rating or 0.0
    return min(r / 5.0, 1.0)


def _score_volunteer(request_obj: Request, volunteer: User) -> tuple[float, str]:
    """Score using the spec formula:
    score = (0.4 * skill_match) + (0.25 * distance_score) + (0.2 * availability) + (0.15 * rating)
    """
    distance_km = haversine_km(request_obj.lat, request_obj.lng, volunteer.lat, volunteer.lng)
    request_skills = {skill.name.lower() for skill in request_obj.skills}
    volunteer_skills = {skill.name.lower() for skill in volunteer.skills}

    skill = _skill_score(request_skills, volunteer_skills)
    dist = _distance_score(distance_km)
    avail = _availability_score(volunteer)
    rating = _rating_score(volunteer)

    final_score = (skill * 0.4) + (dist * 0.25) + (avail * 0.2) + (rating * 0.15)
    reason = (
        f"skill={skill:.2f}, distance={distance_km:.1f}km ({dist:.2f}), "
        f"availability={avail:.1f}, rating={rating:.2f}"
    )
    return round(final_score, 3), reason


def _score_volunteer_disaster(request_obj: Request, volunteer: User) -> tuple[float, str]:
    """DISASTER mode: prioritize distance + availability."""
    distance_km = haversine_km(request_obj.lat, request_obj.lng, volunteer.lat, volunteer.lng)
    request_skills = {skill.name.lower() for skill in request_obj.skills}
    volunteer_skills = {skill.name.lower() for skill in volunteer.skills}

    skill = _skill_score(request_skills, volunteer_skills)
    dist = _distance_score(distance_km)
    avail = _availability_score(volunteer)
    rating = _rating_score(volunteer)

    # Disaster: weight distance and availability higher
    final_score = (skill * 0.25) + (dist * 0.35) + (avail * 0.30) + (rating * 0.10)
    reason = (
        f"[DISASTER] skill={skill:.2f}, distance={distance_km:.1f}km ({dist:.2f}), "
        f"availability={avail:.1f}, rating={rating:.2f}"
    )
    return round(final_score, 3), reason


def _score_volunteer_ngo(request_obj: Request, volunteer: User) -> tuple[float, str]:
    """NGO mode: prioritize skill match + rating."""
    distance_km = haversine_km(request_obj.lat, request_obj.lng, volunteer.lat, volunteer.lng)
    request_skills = {skill.name.lower() for skill in request_obj.skills}
    volunteer_skills = {skill.name.lower() for skill in volunteer.skills}

    skill = _skill_score(request_skills, volunteer_skills)
    dist = _distance_score(distance_km)
    avail = _availability_score(volunteer)
    rating = _rating_score(volunteer)

    # NGO: weight skill match and rating higher
    final_score = (skill * 0.45) + (dist * 0.15) + (avail * 0.15) + (rating * 0.25)
    reason = (
        f"[NGO] skill={skill:.2f}, distance={distance_km:.1f}km ({dist:.2f}), "
        f"availability={avail:.1f}, rating={rating:.2f}"
    )
    return round(final_score, 3), reason


def score_volunteer_for_request(request_obj: Request, volunteer: User) -> tuple[float, str]:
    mode = (request_obj.mode or "DISASTER").upper()
    if mode == "NGO":
        return _score_volunteer_ngo(request_obj, volunteer)
    return _score_volunteer_disaster(request_obj, volunteer)


def match_volunteers(db: Session, request_id: int, top_n: int = 3) -> list[dict]:
    """Return top N volunteers with scores and justifications without assigning."""
    request_obj = db.scalar(
        select(Request)
        .options(selectinload(Request.skills), selectinload(Request.assignments))
        .where(Request.id == request_id)
    )
    if not request_obj:
        raise ValueError("Task not found")

    volunteer_filters = [
        User.role == "volunteer",
        User.availability.is_(True),
        User.status == "available",
    ]
    if config.USE_MOCK_DATA:
        pool = mock_data.get_assignable_volunteer_ids()
        if pool:
            volunteer_filters.append(User.id.in_(pool))

    volunteers = db.scalars(
        select(User).options(selectinload(User.skills)).where(and_(*volunteer_filters))
    ).all()

    ranked = []
    for volunteer in volunteers:
        score, reason = score_volunteer_for_request(request_obj, volunteer)
        if score > 0:
            ranked.append({"volunteer": volunteer, "score": score, "justification": reason})

    ranked.sort(key=lambda item: item["score"], reverse=True)
    return ranked[:top_n]


def run_assignment(db: Session, request_id: int, excluded_volunteer_ids: set[int] | None = None) -> list[Assignment]:
    excluded_volunteer_ids = excluded_volunteer_ids or set()
    request_obj = db.scalar(
        select(Request)
        .options(selectinload(Request.skills), selectinload(Request.assignments))
        .where(Request.id == request_id)
    )
    if not request_obj:
        raise ValueError("Request not found")

    # NGO mode: do NOT auto-assign
    mode = (request_obj.mode or "DISASTER").upper()
    if mode == "NGO":
        return []

    volunteer_filters = [
        User.role == "volunteer",
        User.availability.is_(True),
        User.status == "available",
    ]
    if excluded_volunteer_ids:
        volunteer_filters.append(User.id.not_in(excluded_volunteer_ids))

    if config.USE_MOCK_DATA:
        pool = mock_data.get_assignable_volunteer_ids()
        if pool:
            volunteer_filters.append(User.id.in_(pool))

    volunteers = db.scalars(select(User).options(selectinload(User.skills)).where(and_(*volunteer_filters))).all()

    ranked = []
    for volunteer in volunteers:
        score, reason = score_volunteer_for_request(request_obj, volunteer)
        if score > 0:
            ranked.append((score, reason, volunteer))

    ranked.sort(key=lambda item: item[0], reverse=True)
    _, cluster_size = cluster_metrics_for_request(db, request_obj.lat, request_obj.lng)
    target_count = allocation_count(request_obj.priority_level, request_obj.people_count, cluster_size)
    created: list[Assignment] = []
    used_ids = {assignment.volunteer_id for assignment in request_obj.assignments}

    for score, reason, volunteer in ranked:
        if len(created) >= target_count:
            break
        if volunteer.id in used_ids:
            continue
        assignment = Assignment(
            request_id=request_obj.id,
            volunteer_id=volunteer.id,
            score=score,
            status="accepted",
            reason=f"{reason}; auto-assigned",
        )
        update_volunteer_status(volunteer, "assigned", availability=False)
        db.add(assignment)
        db.add(volunteer)
        created.append(assignment)
        used_ids.add(volunteer.id)

    update_request_status(db, request_obj)
    db.flush()
    return created


def reassign_request(db: Session, request_id: int, excluded_volunteer_ids: set[int]) -> list[Assignment]:
    return run_assignment(db, request_id=request_id, excluded_volunteer_ids=excluded_volunteer_ids)
