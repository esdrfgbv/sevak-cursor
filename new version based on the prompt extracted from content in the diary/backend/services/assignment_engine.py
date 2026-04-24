from sqlalchemy import and_, select
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
    return 0.4


def _skill_score(request_skills: set[str], volunteer_skills: set[str]) -> float:
    if not request_skills:
        return 1.0
    matches = len(request_skills.intersection(volunteer_skills))
    if matches == len(request_skills):
        return 1.0
    if matches > 0:
        return 0.5
    return 0.0


def _availability_score(volunteer: User) -> int:
    return 1 if volunteer.availability and volunteer.status == "available" else 0


def _score_volunteer(request_obj: Request, volunteer: User) -> tuple[float, str]:
    distance_km = haversine_km(request_obj.lat, request_obj.lng, volunteer.lat, volunteer.lng)
    request_skills = {skill.name.lower() for skill in request_obj.skills}
    volunteer_skills = {skill.name.lower() for skill in volunteer.skills}

    skill_score = _skill_score(request_skills, volunteer_skills)
    distance_score = _distance_score(distance_km)
    availability_score = _availability_score(volunteer)

    final_score = (skill_score * 0.5) + (distance_score * 0.3) + (availability_score * 0.2)
    reason = (
        f"skill={skill_score:.1f}, distance={distance_km:.1f}km ({distance_score:.1f}), "
        f"availability={availability_score}"
    )
    return round(final_score, 3), reason


def score_volunteer_for_request(request_obj: Request, volunteer: User) -> tuple[float, str]:
    return _score_volunteer(request_obj, volunteer)


def run_assignment(db: Session, request_id: int, excluded_volunteer_ids: set[int] | None = None) -> list[Assignment]:
    excluded_volunteer_ids = excluded_volunteer_ids or set()
    request_obj = db.scalar(
        select(Request)
        .options(selectinload(Request.skills), selectinload(Request.assignments))
        .where(Request.id == request_id)
    )
    if not request_obj:
        raise ValueError("Request not found")

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
        score, reason = _score_volunteer(request_obj, volunteer)
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
