import re
from collections.abc import Iterable

import models
import schemas
from models import request_from_dict
from services.cluster_service import haversine_km
from firebase_service import get_requests
from services.priority_engine import calculate_priority

STOP_WORDS = {
    "a",
    "an",
    "and",
    "are",
    "at",
    "by",
    "for",
    "from",
    "in",
    "into",
    "is",
    "near",
    "of",
    "on",
    "or",
    "the",
    "to",
    "with",
}


def _tokenize(*values: str) -> set[str]:
    tokens: set[str] = set()
    for value in values:
        if not value:
            continue
        for token in re.findall(r"[a-z0-9]+", value.lower()):
            if len(token) > 2 and token not in STOP_WORDS:
                tokens.add(token)
    return tokens


def _overlap_score(left: Iterable[str], right: Iterable[str]) -> float:
    left_set = {item for item in left if item}
    right_set = {item for item in right if item}
    if not left_set or not right_set:
        return 0.0
    return len(left_set.intersection(right_set)) / len(left_set.union(right_set))


def _duplicate_similarity(payload: schemas.RequestCreate, request_obj: models.Request) -> tuple[float, float]:
    distance_km = haversine_km(payload.lat, payload.lng, request_obj.lat, request_obj.lng)
    incoming_text = _tokenize(payload.incident_type, payload.title, payload.description)
    request_text = _tokenize(request_obj.incident_type, request_obj.title, request_obj.description)
    text_overlap = _overlap_score(incoming_text, request_text)
    incoming_skills = {skill.lower() for skill in payload.required_skills}
    request_skills = {skill.name.lower() for skill in request_obj.skills}
    skill_overlap = _overlap_score(incoming_skills, request_skills)
    incident_type_match = 1.0 if payload.incident_type.strip().lower() == request_obj.incident_type.strip().lower() else 0.0
    people_delta = abs((payload.people_count or 0) - (request_obj.people_count or 0))
    people_score = 1.0 if people_delta <= 2 else 0.5 if people_delta <= 5 else 0.0
    distance_score = max(0.0, 1 - (distance_km / 2.0))

    similarity = (
        (incident_type_match * 0.35)
        + (text_overlap * 0.35)
        + (skill_overlap * 0.15)
        + (people_score * 0.05)
        + (distance_score * 0.10)
    )
    return similarity, distance_km


def find_duplicate_request(payload: schemas.RequestCreate) -> tuple[models.Request | None, float]:
    request_dicts = get_requests()
    requests = [request_from_dict(d) for d in request_dicts if d.get("status") != "completed"]

    best_match = None
    best_similarity = 0.0
    for request_obj in requests:
        similarity, distance_km = _duplicate_similarity(payload, request_obj)
        if distance_km > 2:
            continue
        if similarity >= 0.55 and similarity > best_similarity:
            best_match = request_obj
            best_similarity = similarity

    return best_match, best_similarity


def duplicate_signal_points(payload: schemas.RequestCreate, cluster_boost: int) -> int:
    priority_score, _ = calculate_priority(payload.description, payload.people_count, payload.required_skills, cluster_boost)
    return max(10, min(25, round(priority_score * 0.25)))
