import config
from models import Assignment, Request, User, user_from_firestore
from services.cluster_service import haversine_km
from firebase_service import get_users, get_request_by_id, update_request
from services.state_manager import update_request_status, update_volunteer_status


MAX_AI_CANDIDATES = 25
MAX_DISTANCE_KM = float(getattr(config, "MAX_ASSIGNMENT_DISTANCE_KM", 50))  # absolute hard limit
PRIMARY_DISTANCE_KM = float(getattr(config, "DEMO_RADIUS_KM", 20))  # demo: prefer/require nearby


def calculate_required_volunteers(task: Request) -> int:
    people_count = max(int(task.people_count or 0), 0)
    mode = (task.mode or "DISASTER").upper()
    if mode == "DISASTER":
        base = 3
        additional = people_count / 20.0
        required = int(round(base + additional))
        return max(3, min(required, 15))
    # NGO: small coordination group, manual acceptance
    required = int(round(2 + (people_count / 50.0)))
    return max(2, min(required, 5))


def _distance_score(distance_km: float) -> float:
    if distance_km > MAX_DISTANCE_KM:
        return 0.0  # Eliminate volunteers beyond 50km
    if distance_km < 2:
        return 1.0
    if distance_km < 5:
        return 0.7
    if distance_km < 10:
        return 0.4
    if distance_km < 25:
        return 0.2
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


def _fit_label(score: float) -> str:
    if score >= 0.85:
        return "High Match"
    if score >= 0.7:
        return "Strong Fit"
    if score >= 0.5:
        return "Good Fit"
    return "Backup Fit"


def _human_reason(mode: str, skill: float, distance_km: float, avail: float, rating: float, final_score: float) -> str:
    # Structured, demo-friendly reasoning (no fake AI prose)
    skill_label = "Skill match" if skill >= 1 else ("Partial skill match" if skill > 0 else "Backup skill fit")
    availability_label = "Available" if avail >= 1 else ("Limited availability" if avail > 0 else "Not available")
    reliability_label = "High rating" if rating >= 0.9 else "Normal rating"
    return (
        f"Selected due to: {skill_label} + {distance_km:.1f}km distance + {availability_label} + {reliability_label} "
        f"(score {final_score:.2f})"
    )


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
    reason = _human_reason("STANDARD", skill, distance_km, avail, rating, final_score)
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
    reason = _human_reason("DISASTER", skill, distance_km, avail, rating, final_score)
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
    reason = _human_reason("NGO", skill, distance_km, avail, rating, final_score)
    return round(final_score, 3), reason


def score_volunteer_for_request(request_obj: Request, volunteer: User) -> tuple[float, str]:
    mode = (request_obj.mode or "DISASTER").upper()
    if mode == "NGO":
        return _score_volunteer_ngo(request_obj, volunteer)
    return _score_volunteer_disaster(request_obj, volunteer)


def _candidate_payload(request_obj: Request, volunteer: User, score: float, reason: str) -> dict:
    distance_km = haversine_km(request_obj.lat, request_obj.lng, volunteer.lat, volunteer.lng)
    return {
        "volunteer": volunteer,
        "volunteer_id": volunteer.id,
        "skills": [skill.name for skill in volunteer.skills],
        "distance_km": round(distance_km, 2),
        "availability": 100 if volunteer.availability and volunteer.status == "available" else 0,
        "rating": round(float(volunteer.rating or 0.0), 2),
        "workload": int(volunteer.workload or 0),
        "score": score,
        "justification": reason,
    }


def _available_volunteers(request_obj: Request | None = None, excluded_volunteer_ids: set[int] | None = None) -> list[User]:
    """Get available volunteers within MAX_DISTANCE_KM of request."""
    # Get all volunteers from Firebase
    all_volunteers_data = get_users(role='volunteer')
    
    # Convert to User models
    volunteers = [user_from_firestore(v) for v in all_volunteers_data]
    
    # Filter by availability
    available = [v for v in volunteers if v.availability and v.status == 'available']
    
    # Filter out excluded volunteers
    if excluded_volunteer_ids:
        available = [v for v in available if v.id not in excluded_volunteer_ids]
    
    # CRITICAL: Filter by distance - exclude volunteers beyond MAX_DISTANCE_KM
    if request_obj:
        filtered_volunteers = []
        for v in available:
            distance_km = haversine_km(request_obj.lat, request_obj.lng, v.lat, v.lng)
            if distance_km <= MAX_DISTANCE_KM:
                filtered_volunteers.append(v)
        return filtered_volunteers
    
    return available


def get_top_candidates(
    request_obj: Request,
    *,
    limit: int = MAX_AI_CANDIDATES,
    excluded_volunteer_ids: set[int] | None = None,
) -> list[dict]:
    ranked = []
    for volunteer in _available_volunteers(request_obj, excluded_volunteer_ids):
        score, reason = score_volunteer_for_request(request_obj, volunteer)
        if score > 0:
            ranked.append(_candidate_payload(request_obj, volunteer, score, reason))

    ranked.sort(key=lambda item: item["score"], reverse=True)
    
    if not ranked:
        return []
    
    return ranked[:limit]

def _select_algorithmic(request_obj: Request, candidates: list[dict], required_count: int) -> dict:
    """Algorithmic selection only (distance + skills + availability + rating)."""
    bounded_count = min(required_count, len(candidates))
    if bounded_count <= 0:
        return {"selected": [], "insight": "No nearby volunteers available for this task."}

    picked = candidates[:bounded_count]
    selected = [
        {
            "volunteer_id": item["volunteer_id"],
            "score": round(float(item["score"]) * 100, 1),
            "reason": item["justification"],
        }
        for item in picked
    ]
    mode = (request_obj.mode or "DISASTER").upper()
    required = required_count
    if mode == "DISASTER":
        insight = f"Dispatched {len(selected)}/{required} nearby volunteers based on skill fit, distance, availability, and rating."
    else:
        insight = f"Suggested {len(selected)}/{required} nearby volunteers for manual acceptance (skill fit + reliability + proximity)."
    return {"selected": selected, "insight": insight}


def match_volunteers(request_id: str, top_n: int | None = None) -> list[dict]:
    """Return selected volunteers with AI/fallback reasons without assigning."""
    request_data = get_request_by_id(request_id)
    if not request_data:
        raise ValueError("Task not found")
    
    request_obj = User.from_dict(request_data) if hasattr(User, 'from_dict') else Request(
        id=request_data['id'],
        requester_id=request_data.get('requester_id'),
        incident_type=request_data.get('incident_type', ''),
        title=request_data.get('title', ''),
        description=request_data.get('description', ''),
        mode=request_data.get('mode', 'DISASTER'),
        lat=request_data.get('lat', 0.0),
        lng=request_data.get('lng', 0.0),
        people_count=request_data.get('people_count', 0),
        status=request_data.get('status', 'pending'),
        priority_score=request_data.get('priority_score', 0),
        priority_level=request_data.get('priority_level', 'LOW'),
    )

    required_count = top_n or calculate_required_volunteers(request_obj)
    candidates = get_top_candidates(request_obj)

    # Demo constraint: must be within PRIMARY_DISTANCE_KM, otherwise treat as none nearby
    nearby = [c for c in candidates if c.get("distance_km", 999) <= PRIMARY_DISTANCE_KM]
    if not nearby:
        update_request(request_id, {"ai_insight": f"No nearby volunteers (within {PRIMARY_DISTANCE_KM:.0f}km) available."})
        return []

    ai_result = _select_algorithmic(request_obj, nearby, required_count)
    
    # Update request with AI insight
    update_request(request_id, {'ai_insight': ai_result['insight']})
    
    candidates_by_id = {item["volunteer_id"]: item for item in candidates}

    matched = []
    for item in ai_result["selected"]:
        candidate = candidates_by_id.get(item["volunteer_id"])
        if not candidate:
            continue
        matched.append({
            "volunteer": candidate["volunteer"],
            "score": round(float(item.get("score", 0)) / 100, 3),
            "justification": str(item.get("reason") or candidate["justification"]),
        })
    return matched


def run_assignment(request_id: str, excluded_volunteer_ids: set[str] | None = None) -> list[dict]:
    """Run assignment for a request using Firebase."""
    excluded_volunteer_ids = excluded_volunteer_ids or set()
    request_data = get_request_by_id(request_id)
    if not request_data:
        raise ValueError("Request not found")

    # Convert to Request model
    request_obj = Request(
        id=request_data['id'],
        requester_id=request_data.get('requester_id'),
        incident_type=request_data.get('incident_type', ''),
        title=request_data.get('title', ''),
        description=request_data.get('description', ''),
        mode=request_data.get('mode', 'DISASTER'),
        lat=request_data.get('lat', 0.0),
        lng=request_data.get('lng', 0.0),
        people_count=request_data.get('people_count', 0),
        status=request_data.get('status', 'pending'),
        priority_score=request_data.get('priority_score', 0),
        priority_level=request_data.get('priority_level', 'LOW'),
    )

    # NGO mode: do NOT auto-assign
    mode = (request_obj.mode or "DISASTER").upper()
    if mode == "NGO":
        return []

    candidates = get_top_candidates(
        request_obj,
        excluded_volunteer_ids=excluded_volunteer_ids,
    )
    nearby = [c for c in candidates if c.get("distance_km", 999) <= PRIMARY_DISTANCE_KM]
    required_count = calculate_required_volunteers(request_obj)
    
    # For simplicity, we're not tracking existing assignments in this version
    remaining_count = required_count
    
    print(
        "[SEVAK DEBUG] ASSIGNMENT_INPUT "
        f"request_id={request_obj.id} people_count={request_obj.people_count} "
        f"priority={request_obj.priority_level} required={required_count} "
        f"remaining={remaining_count} candidates={len(candidates)}"
    )
    
    if remaining_count == 0:
        update_request(request_id, {"ai_insight": request_obj.ai_insight or "Required volunteer count already met."})
        return []

    if not nearby:
        update_request(request_id, {"ai_insight": f"No nearby volunteers (within {PRIMARY_DISTANCE_KM:.0f}km) available."})
        return []

    ai_result = _select_algorithmic(request_obj, nearby, remaining_count)
    
    # Update request with AI insight
    update_request(request_id, {'ai_insight': ai_result['insight']})
    
    candidates_by_id = {item["volunteer_id"]: item for item in candidates}
    created_assignments = []

    for selection in ai_result["selected"]:
        candidate = candidates_by_id.get(selection["volunteer_id"])
        if not candidate:
            continue
        volunteer = candidate["volunteer"]
        
        # Create assignment in Firebase
        score = round(float(selection.get("score", 0)) / 100, 3)
        reason = str(selection.get("reason") or candidate["justification"])
        
        from firebase_service import create_assignment, update_user
        
        assignment_data = {
            'request_id': request_id,
            'volunteer_id': str(volunteer.id),
            'score': score,
            'status': 'accepted',
            'reason': reason,
        }
        
        assignment = create_assignment(assignment_data)
        created_assignments.append(assignment)
        
        # Update volunteer status
        update_user(str(volunteer.id), {
            'status': 'assigned',
            'availability': False,
            'workload': (volunteer.workload or 0) + 1
        })

    return created_assignments


def reassign_request(request_id: str, excluded_volunteer_ids: set[str]) -> list[dict]:
    """Reassign a request with excluded volunteers."""
    return run_assignment(request_id=request_id, excluded_volunteer_ids=excluded_volunteer_ids)
