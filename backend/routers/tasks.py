from fastapi import APIRouter, HTTPException

import schemas
from firebase_service import (
    create_request,
    ensure_skills,
    get_request_by_id,
    get_requests,
    update_request,
)
from models import request_from_dict
from services.assignment_engine import calculate_required_volunteers, match_volunteers, run_assignment
from services.cluster_service import cluster_metrics_for_request, haversine_km
from services.incident_matching import duplicate_signal_points, find_duplicate_request
from services.priority_engine import calculate_priority, explain_priority
from services.state_manager import update_request_status
from services.vision_pipeline import analyze_incident_image

router = APIRouter(prefix="/api/tasks", tags=["tasks"])


def _fit_label(score: float) -> str:
    if score >= 0.85:
        return "High Match"
    if score >= 0.7:
        return "Strong Fit"
    if score >= 0.5:
        return "Good Fit"
    return "Backup Fit"


def _response_tag(mode: str, index: int) -> str:
    if index == 0 and mode == "DISASTER":
        return "Fastest Responder"
    if index == 0:
        return "Best Program Fit"
    return "Ready Backup" if mode == "DISASTER" else "Qualified Match"


def _clean_from_assignment(request_obj, assignment, index: int) -> schemas.CleanVolunteerDecision | None:
    if not assignment.volunteer:
        return None
    distance = haversine_km(request_obj.lat, request_obj.lng, assignment.volunteer.lat, assignment.volunteer.lng)
    return schemas.CleanVolunteerDecision(
        id=assignment.volunteer.id,
        name=assignment.volunteer.name,
        fit=assignment.match_label or _fit_label(assignment.score),
        reason=assignment.reason,
        distance=f"{distance:.1f} km",
        tag=_response_tag((request_obj.mode or "DISASTER").upper(), index),
    )


def _clean_from_match(request_obj, match: dict, index: int) -> schemas.CleanVolunteerDecision:
    volunteer = match["volunteer"]
    distance = haversine_km(request_obj.lat, request_obj.lng, volunteer.lat, volunteer.lng)
    return schemas.CleanVolunteerDecision(
        id=volunteer.id,
        name=volunteer.name,
        fit=_fit_label(float(match["score"])),
        reason=match["justification"],
        distance=f"{distance:.1f} km",
        tag=_response_tag((request_obj.mode or "DISASTER").upper(), index),
    )


def _clean_assignments(request_obj) -> list[schemas.CleanVolunteerDecision]:
    clean = []
    for index, assignment in enumerate(request_obj.assignments or []):
        item = _clean_from_assignment(request_obj, assignment, index)
        if item:
            clean.append(item)
    return clean


@router.post("", response_model=schemas.RequestCreateResponse)
def create_task(payload: schemas.RequestCreate):
    mode = (payload.mode or "DISASTER").upper()
    if mode not in ("DISASTER", "NGO"):
        raise HTTPException(status_code=400, detail="Mode must be DISASTER or NGO")

    ensure_skills(payload.required_skills)

    cluster_boost, _cluster_size = cluster_metrics_for_request(payload.lat, payload.lng)
    priority_score, priority_level = calculate_priority(
        payload.description, payload.people_count, payload.required_skills, cluster_boost,
    )

    if mode == "DISASTER" and not payload.image_data:
        raise HTTPException(
            status_code=400, 
            detail="DISASTER mode requires evidence photo for AI verification. Please upload an image."
        )

    verification = None
    image_status = "not_submitted"
    image_reason = "No image attached."
    image_url = None

    if mode == "DISASTER":
        image_status, image_reason, image_url, verification_payload = analyze_incident_image(
            image_data=payload.image_data,
            incident_type=payload.incident_type,
            description=payload.description,
        )
        verification = schemas.ImageVerificationSummary(**verification_payload)
    else:
        image_status = "not_required"
        image_reason = "Image verification skipped for NGO mode."
        image_url = payload.image_data
        verification = schemas.ImageVerificationSummary(
            is_disaster=None, confidence=None, labels=[], reason=image_reason, warnings=[]
        )

    duplicate_request, _ = find_duplicate_request(payload)
    duplicate_points_added = 0

    if duplicate_request:
        duplicate_points_added = duplicate_signal_points(payload, cluster_boost)
        duplicate_request.severity_support_points += duplicate_points_added
        dup_priority_score, dup_priority_level = calculate_priority(
            duplicate_request.description,
            duplicate_request.people_count,
            [skill.name for skill in duplicate_request.skills],
            duplicate_request.cluster_boost + duplicate_request.severity_support_points,
        )
        duplicate_request.priority_score = dup_priority_score
        duplicate_request.priority_level = dup_priority_level
        
        update_request(duplicate_request.id, {
            "severity_support_points": duplicate_request.severity_support_points,
            "priority_score": duplicate_request.priority_score,
            "priority_level": duplicate_request.priority_level
        })
        
        if (duplicate_request.mode or "DISASTER").upper() == "DISASTER":
            run_assignment(duplicate_request.id, {a.volunteer_id for a in duplicate_request.assignments})
        update_request_status(duplicate_request.id)
        
        priority_score = dup_priority_score
        priority_level = dup_priority_level

    req_data = {
        "requester_id": payload.requester_id,
        "incident_type": payload.incident_type,
        "title": payload.title,
        "description": payload.description,
        "mode": mode,
        "lat": payload.lat,
        "lng": payload.lng,
        "people_count": payload.people_count,
        "priority_score": priority_score,
        "priority_level": priority_level,
        "cluster_boost": cluster_boost,
        "severity_support_points": duplicate_points_added,
        "image_url": image_url,
        "image_verification_status": image_status,
        "image_verification_reason": image_reason,
        "required_skills": payload.required_skills,
    }
    
    created = create_request(req_data)
    request_id = created["id"]

    match_results = None
    if mode == "DISASTER":
        run_assignment(request_id)
    else:
        matched = match_volunteers(request_id)
        request_obj = request_from_dict(get_request_by_id(request_id))
        match_results = schemas.MatchResponse(
            task_id=request_id,
            mode=mode,
            top_volunteers=[
                schemas.MatchResult(
                    volunteer=m["volunteer"],
                    score=m["score"],
                    match_label=_fit_label(float(m["score"])),
                    justification=m["justification"],
                )
                for m in matched
            ],
            clean_volunteers=[_clean_from_match(request_obj, m, index) for index, m in enumerate(matched)],
            auto_assigned=False,
        )

    update_request_status(request_id)

    request_detail = request_from_dict(get_request_by_id(request_id))
    duplicate_detail = request_from_dict(get_request_by_id(duplicate_request.id)) if duplicate_request else None
    suggested = list(request_detail.assignments) if request_detail else []

    return {
        "request": request_detail,
        "ai_insight": request_detail.ai_insight if request_detail else None,
        "priority_explanation": request_detail.priority_explanation if request_detail else None,
        "assigned_count": len(suggested),
        "suggested_volunteers": suggested,
        "clean_volunteers": _clean_assignments(request_detail) if request_detail else [],
        "duplicate_detected": duplicate_request is not None,
        "duplicate_points_added": duplicate_points_added,
        "duplicate_request": duplicate_detail,
        "verification": verification,
        "match_results": match_results,
    }


@router.get("", response_model=list[schemas.RequestDetail])
def list_tasks(mode: str | None = None, status: str | None = None):
    requests = [request_from_dict(d) for d in get_requests(mode=mode, status=status)]
    return requests


@router.get("/{task_id}", response_model=schemas.RequestDetail)
def get_task(task_id: int):
    req_dict = get_request_by_id(task_id)
    if not req_dict:
        raise HTTPException(status_code=404, detail="Task not found")
    return request_from_dict(req_dict)


@router.get("/{task_id}/decision-flow", response_model=schemas.DecisionFlowResponse)
def decision_flow(task_id: int):
    req_dict = get_request_by_id(task_id)
    if not req_dict:
        raise HTTPException(status_code=404, detail="Task not found")
        
    request_obj = request_from_dict(req_dict)
    mode = (request_obj.mode or "DISASTER").upper()
    selection_reason = "Proximity + skill + availability" if mode == "DISASTER" else "Skill fit + reliability + acceptance readiness"
    
    return schemas.DecisionFlowResponse(
        priority=explain_priority(
            request_obj.description,
            request_obj.people_count,
            [skill.name for skill in request_obj.skills],
            request_obj.cluster_boost + request_obj.severity_support_points,
        ),
        required_volunteers=calculate_required_volunteers(request_obj),
        selection_reason=selection_reason,
        ai_insight=request_obj.ai_insight,
        clean_volunteers=_clean_assignments(request_obj),
    )


@router.put("/{task_id}", response_model=schemas.RequestDetail)
def update_task(task_id: int, payload: schemas.TaskUpdate):
    req_dict = get_request_by_id(task_id)
    if not req_dict:
        raise HTTPException(status_code=404, detail="Task not found")
        
    updates = {}
    if payload.title is not None:
        updates["title"] = payload.title
    if payload.description is not None:
        updates["description"] = payload.description
    if payload.status is not None:
        updates["status"] = payload.status
    if payload.priority_level is not None:
        updates["priority_level"] = payload.priority_level
    if payload.mode is not None:
        updates["mode"] = payload.mode.upper()
        
    if updates:
        update_request(task_id, updates)
        
    return request_from_dict(get_request_by_id(task_id))


@router.post("/bulk", response_model=list[schemas.RequestDetail])
def bulk_create_tasks(payload: schemas.TaskBulkCreate):
    created_ids = []
    for task_data in payload.tasks:
        ensure_skills(task_data.required_skills)

        mode = (task_data.mode or "DISASTER").upper()
        cluster_boost, _ = cluster_metrics_for_request(task_data.lat, task_data.lng)
        priority_score, priority_level = calculate_priority(
            task_data.description, task_data.people_count, task_data.required_skills, cluster_boost,
        )

        req_data = {
            "requester_id": task_data.requester_id,
            "incident_type": task_data.incident_type,
            "title": task_data.title,
            "description": task_data.description,
            "mode": mode,
            "lat": task_data.lat,
            "lng": task_data.lng,
            "people_count": task_data.people_count,
            "priority_score": priority_score,
            "priority_level": priority_level,
            "cluster_boost": cluster_boost,
            "required_skills": task_data.required_skills,
        }
        
        created = create_request(req_data)
        request_id = created["id"]
        
        if mode == "DISASTER":
            run_assignment(request_id)
        update_request_status(request_id)
        created_ids.append(request_id)

    results = []
    for rid in created_ids:
        results.append(request_from_dict(get_request_by_id(rid)))
    return results


@router.post("/{task_id}/match", response_model=schemas.MatchResponse)
def match_task(task_id: int):
    req_dict = get_request_by_id(task_id)
    if not req_dict:
        raise HTTPException(status_code=404, detail="Task not found")
        
    request_obj = request_from_dict(req_dict)
    mode = (request_obj.mode or "DISASTER").upper()
    auto_assigned = False
    
    if mode == "DISASTER":
        created = run_assignment(task_id)
        auto_assigned = bool(created)
        refreshed = request_from_dict(get_request_by_id(task_id))
        assignments = list(refreshed.assignments) if refreshed else []
        return schemas.MatchResponse(
            task_id=task_id,
            mode=mode,
            top_volunteers=[
                schemas.MatchResult(
                    volunteer=a.volunteer,
                    score=a.score,
                    match_label=a.match_label,
                    justification=a.reason,
                )
                for a in assignments
                if a.volunteer
            ],
            clean_volunteers=_clean_assignments(refreshed) if refreshed else [],
            auto_assigned=auto_assigned,
        )

    matched = match_volunteers(task_id)
    return schemas.MatchResponse(
        task_id=task_id,
        mode=mode,
        top_volunteers=[
            schemas.MatchResult(
                volunteer=m["volunteer"],
                score=m["score"],
                match_label=_fit_label(float(m["score"])),
                justification=m["justification"],
            )
            for m in matched
        ],
        clean_volunteers=[_clean_from_match(request_obj, m, index) for index, m in enumerate(matched)],
        auto_assigned=auto_assigned,
    )
