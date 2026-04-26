"""Tasks router with /api/tasks/ prefix. Maps Request model to 'task' concept."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from .. import models, schemas
from ..database import get_db
from ..services.assignment_engine import calculate_required_volunteers, match_volunteers, run_assignment, score_volunteer_for_request
from ..services.cluster_service import cluster_metrics_for_request, haversine_km
from ..services.incident_matching import duplicate_signal_points, find_duplicate_request
from ..services.priority_engine import calculate_priority, explain_priority
from ..services.state_manager import update_request_status
from ..services.vision_pipeline import analyze_incident_image

router = APIRouter(prefix="/api/tasks", tags=["tasks"])


def _load_request(db: Session, request_id: int) -> models.Request:
    return db.scalar(
        select(models.Request)
        .options(
            selectinload(models.Request.skills),
            selectinload(models.Request.assignments)
            .selectinload(models.Assignment.volunteer)
            .selectinload(models.User.skills),
            selectinload(models.Request.support_votes),
        )
        .where(models.Request.id == request_id)
    )


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


def _clean_from_assignment(request_obj: models.Request, assignment: models.Assignment, index: int) -> schemas.CleanVolunteerDecision | None:
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


def _clean_from_match(request_obj: models.Request, match: dict, index: int) -> schemas.CleanVolunteerDecision:
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


def _clean_assignments(request_obj: models.Request) -> list[schemas.CleanVolunteerDecision]:
    clean = []
    for index, assignment in enumerate(request_obj.assignments or []):
        item = _clean_from_assignment(request_obj, assignment, index)
        if item:
            clean.append(item)
    return clean


@router.post("", response_model=schemas.RequestCreateResponse)
def create_task(payload: schemas.RequestCreate, db: Session = Depends(get_db)):
    mode = (payload.mode or "DISASTER").upper()
    if mode not in ("DISASTER", "NGO"):
        raise HTTPException(status_code=400, detail="Mode must be DISASTER or NGO")

    print(
        "[SEVAK DEBUG] TASK_PAYLOAD "
        f"mode={mode} people_count={payload.people_count} "
        f"incident_type={payload.incident_type!r}"
    )

    # DISASTER mode: image verification is MANDATORY
    if mode == "DISASTER" and not payload.image_data:
        # Allow creation but mark as not_submitted
        pass

    skill_models = []
    for skill_name in payload.required_skills:
        skill = db.scalar(select(models.Skill).where(models.Skill.name == skill_name))
        if not skill:
            skill = models.Skill(name=skill_name)
            db.add(skill)
            db.flush()
        skill_models.append(skill)

    cluster_boost, _cluster_size = cluster_metrics_for_request(db, payload.lat, payload.lng)
    priority_score, priority_level = calculate_priority(
        payload.description, payload.people_count, payload.required_skills, cluster_boost,
    )

    # ENFORCE: DISASTER mode requires image verification
    if mode == "DISASTER" and not payload.image_data:
        raise HTTPException(
            status_code=400, 
            detail="DISASTER mode requires evidence photo for AI verification. Please upload an image."
        )

    # Image verification: run for DISASTER, skip for NGO
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
        # NGO mode: skip image verification entirely
        image_status = "not_required"
        image_reason = "Image verification skipped for NGO mode."
        image_url = payload.image_data  # Store if provided but don't verify
        verification = schemas.ImageVerificationSummary(
            is_disaster=None, confidence=None, labels=[], reason=image_reason, warnings=[]
        )

    # Duplicate detection
    duplicate_request, _ = find_duplicate_request(db, payload)
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
        db.add(duplicate_request)
        if (duplicate_request.mode or "DISASTER").upper() == "DISASTER":
            run_assignment(db, duplicate_request.id, {a.volunteer_id for a in duplicate_request.assignments})
        update_request_status(db, duplicate_request)
        priority_score = dup_priority_score
        priority_level = dup_priority_level

    request_obj = models.Request(
        requester_id=payload.requester_id,
        incident_type=payload.incident_type,
        title=payload.title,
        description=payload.description,
        mode=mode,
        lat=payload.lat,
        lng=payload.lng,
        people_count=payload.people_count,
        priority_score=priority_score,
        priority_level=priority_level,
        cluster_boost=cluster_boost,
        severity_support_points=duplicate_points_added,
        image_url=image_url,
        image_verification_status=image_status,
        image_verification_reason=image_reason,
    )
    request_obj.skills = skill_models
    db.add(request_obj)
    db.flush()
    print(
        "[SEVAK DEBUG] TASK_CREATED "
        f"id={request_obj.id} people_count={request_obj.people_count} "
        f"priority={request_obj.priority_level}"
    )

    # DISASTER mode: auto-assign volunteers
    # NGO mode: just match but don't assign
    match_results = None
    if mode == "DISASTER":
        run_assignment(db, request_obj.id)
    else:
        # For NGO, compute match results to show to UI
        matched = match_volunteers(db, request_obj.id)
        match_results = schemas.MatchResponse(
            task_id=request_obj.id,
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

    update_request_status(db, request_obj)
    db.commit()

    request_detail = _load_request(db, request_obj.id)
    duplicate_detail = _load_request(db, duplicate_request.id) if duplicate_request else None
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
def list_tasks(mode: str | None = None, status: str | None = None, db: Session = Depends(get_db)):
    query = (
        select(models.Request)
        .options(
            selectinload(models.Request.skills),
            selectinload(models.Request.assignments)
            .selectinload(models.Assignment.volunteer)
            .selectinload(models.User.skills),
            selectinload(models.Request.support_votes),
        )
    )
    if mode:
        query = query.where(models.Request.mode == mode.upper())
    if status:
        query = query.where(models.Request.status == status)
    query = query.order_by(models.Request.created_at.desc())
    return db.scalars(query).all()


@router.get("/{task_id}", response_model=schemas.RequestDetail)
def get_task(task_id: int, db: Session = Depends(get_db)):
    request_obj = _load_request(db, task_id)
    if not request_obj:
        raise HTTPException(status_code=404, detail="Task not found")
    return request_obj


@router.get("/{task_id}/decision-flow", response_model=schemas.DecisionFlowResponse)
def decision_flow(task_id: int, db: Session = Depends(get_db)):
    request_obj = _load_request(db, task_id)
    if not request_obj:
        raise HTTPException(status_code=404, detail="Task not found")

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
def update_task(task_id: int, payload: schemas.TaskUpdate, db: Session = Depends(get_db)):
    request_obj = _load_request(db, task_id)
    if not request_obj:
        raise HTTPException(status_code=404, detail="Task not found")
    if payload.title is not None:
        request_obj.title = payload.title
    if payload.description is not None:
        request_obj.description = payload.description
    if payload.status is not None:
        request_obj.status = payload.status
    if payload.priority_level is not None:
        request_obj.priority_level = payload.priority_level
    if payload.mode is not None:
        request_obj.mode = payload.mode.upper()
    db.add(request_obj)
    db.commit()
    return _load_request(db, task_id)


@router.post("/bulk", response_model=list[schemas.RequestDetail])
def bulk_create_tasks(payload: schemas.TaskBulkCreate, db: Session = Depends(get_db)):
    created_ids = []
    for task_data in payload.tasks:
        skill_models = []
        for skill_name in task_data.required_skills:
            skill = db.scalar(select(models.Skill).where(models.Skill.name == skill_name))
            if not skill:
                skill = models.Skill(name=skill_name)
                db.add(skill)
                db.flush()
            skill_models.append(skill)

        mode = (task_data.mode or "DISASTER").upper()
        cluster_boost, _ = cluster_metrics_for_request(db, task_data.lat, task_data.lng)
        priority_score, priority_level = calculate_priority(
            task_data.description, task_data.people_count, task_data.required_skills, cluster_boost,
        )

        request_obj = models.Request(
            requester_id=task_data.requester_id,
            incident_type=task_data.incident_type,
            title=task_data.title,
            description=task_data.description,
            mode=mode,
            lat=task_data.lat,
            lng=task_data.lng,
            people_count=task_data.people_count,
            priority_score=priority_score,
            priority_level=priority_level,
            cluster_boost=cluster_boost,
        )
        request_obj.skills = skill_models
        db.add(request_obj)
        db.flush()
        if mode == "DISASTER":
            run_assignment(db, request_obj.id)
        update_request_status(db, request_obj)
        created_ids.append(request_obj.id)

    db.commit()
    results = []
    for rid in created_ids:
        results.append(_load_request(db, rid))
    return results


@router.post("/{task_id}/match", response_model=schemas.MatchResponse)
def match_task(task_id: int, db: Session = Depends(get_db)):
    request_obj = _load_request(db, task_id)
    if not request_obj:
        raise HTTPException(status_code=404, detail="Task not found")

    mode = (request_obj.mode or "DISASTER").upper()
    auto_assigned = False
    if mode == "DISASTER":
        created = run_assignment(db, task_id)
        auto_assigned = bool(created)
        db.commit()
        refreshed = _load_request(db, task_id)
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

    matched = match_volunteers(db, task_id)
    db.commit()
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
