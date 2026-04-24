from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from .. import models, schemas
from ..database import get_db
from ..services.assignment_engine import run_assignment, score_volunteer_for_request
from ..services.cluster_service import cluster_metrics_for_request, haversine_km
from ..services.incident_matching import duplicate_signal_points, find_duplicate_request
from ..services.priority_engine import calculate_priority
from ..services.state_manager import update_request_status, update_volunteer_status
from ..services.vision_pipeline import analyze_incident_image

router = APIRouter()


@router.post("/requests", response_model=schemas.RequestCreateResponse)
def create_request(payload: schemas.RequestCreate, db: Session = Depends(get_db)):
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
        payload.description,
        payload.people_count,
        payload.required_skills,
        cluster_boost,
    )

    image_status, image_reason, image_url, verification_payload = analyze_incident_image(
        image_data=payload.image_data,
        incident_type=payload.incident_type,
        description=payload.description,
    )
    verification = schemas.ImageVerificationSummary(**verification_payload)

    duplicate_request, _ = find_duplicate_request(db, payload)
    duplicate_points_added = 0

    if duplicate_request:
        duplicate_points_added = duplicate_signal_points(payload, cluster_boost)
        duplicate_request.severity_support_points += duplicate_points_added
        duplicate_priority_score, duplicate_priority_level = calculate_priority(
            duplicate_request.description,
            duplicate_request.people_count,
            [skill.name for skill in duplicate_request.skills],
            duplicate_request.cluster_boost + duplicate_request.severity_support_points,
        )
        duplicate_request.priority_score = duplicate_priority_score
        duplicate_request.priority_level = duplicate_priority_level
        db.add(duplicate_request)
        run_assignment(db, duplicate_request.id, {assignment.volunteer_id for assignment in duplicate_request.assignments})
        update_request_status(db, duplicate_request)
        priority_score = duplicate_priority_score
        priority_level = duplicate_priority_level

    request_obj = models.Request(
        requester_id=payload.requester_id,
        incident_type=payload.incident_type,
        title=payload.title,
        description=payload.description,
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

    run_assignment(db, request_obj.id)
    update_request_status(db, request_obj)
    db.commit()

    request_detail = db.scalar(
        select(models.Request)
        .options(
            selectinload(models.Request.skills),
            selectinload(models.Request.assignments).selectinload(models.Assignment.volunteer).selectinload(models.User.skills),
            selectinload(models.Request.support_votes),
        )
        .where(models.Request.id == request_obj.id)
    )
    duplicate_detail = None
    if duplicate_request:
        duplicate_detail = db.scalar(
            select(models.Request)
            .options(
                selectinload(models.Request.skills),
                selectinload(models.Request.assignments).selectinload(models.Assignment.volunteer).selectinload(models.User.skills),
                selectinload(models.Request.support_votes),
            )
            .where(models.Request.id == duplicate_request.id)
        )
    suggested = list(request_detail.assignments) if request_detail else []
    return {
        "request": request_detail,
        "assigned_count": len(suggested),
        "suggested_volunteers": suggested,
        "duplicate_detected": duplicate_request is not None,
        "duplicate_points_added": duplicate_points_added,
        "duplicate_request": duplicate_detail,
        "verification": verification,
    }


@router.get("/requests", response_model=list[schemas.RequestDetail])
def list_requests(db: Session = Depends(get_db)):
    requests = db.scalars(
        select(models.Request)
        .options(
            selectinload(models.Request.skills),
            selectinload(models.Request.assignments).selectinload(models.Assignment.volunteer).selectinload(models.User.skills),
            selectinload(models.Request.support_votes),
        )
        .order_by(models.Request.created_at.desc())
    ).all()
    return requests


@router.get("/requests/{request_id}", response_model=schemas.RequestDetail)
def get_request(request_id: int, db: Session = Depends(get_db)):
    request_obj = db.scalar(
        select(models.Request)
        .options(
            selectinload(models.Request.skills),
            selectinload(models.Request.assignments).selectinload(models.Assignment.volunteer).selectinload(models.User.skills),
            selectinload(models.Request.support_votes),
        )
        .where(models.Request.id == request_id)
    )
    if not request_obj:
        raise HTTPException(status_code=404, detail="Request not found")
    return request_obj


@router.post("/requests/{request_id}/claim", response_model=schemas.AssignmentRead)
def claim_request(request_id: int, payload: schemas.RequestClaimCreate, db: Session = Depends(get_db)):
    request_obj = db.scalar(
        select(models.Request)
        .options(
            selectinload(models.Request.skills),
            selectinload(models.Request.assignments).selectinload(models.Assignment.volunteer),
        )
        .where(models.Request.id == request_id)
    )
    if not request_obj:
        raise HTTPException(status_code=404, detail="Request not found")
    if request_obj.status == "completed":
        raise HTTPException(status_code=400, detail="Completed requests cannot be claimed")

    volunteer = db.scalar(
        select(models.User)
        .options(selectinload(models.User.skills))
        .where(models.User.id == payload.volunteer_id, models.User.role == "volunteer")
    )
    if not volunteer:
        raise HTTPException(status_code=404, detail="Volunteer not found")

    distance_km = haversine_km(request_obj.lat, request_obj.lng, volunteer.lat, volunteer.lng)
    if distance_km > 10:
        raise HTTPException(status_code=400, detail="Volunteer is too far from this request")

    existing = next((item for item in request_obj.assignments if item.volunteer_id == volunteer.id), None)
    if existing:
        existing.status = "accepted"
        update_volunteer_status(volunteer, "assigned", availability=False)
        db.add(existing)
        db.add(volunteer)
        update_request_status(db, request_obj)
        db.commit()
        db.refresh(existing)
        return existing

    score, reason = score_volunteer_for_request(request_obj, volunteer)
    assignment = models.Assignment(
        request_id=request_obj.id,
        volunteer_id=volunteer.id,
        score=score,
        reason=f"{reason}; self-claimed nearby request",
        status="accepted",
    )
    update_volunteer_status(volunteer, "assigned", availability=False)
    db.add(assignment)
    db.add(volunteer)
    update_request_status(db, request_obj)
    db.commit()

    assignment = db.scalar(
        select(models.Assignment)
        .options(selectinload(models.Assignment.volunteer).selectinload(models.User.skills))
        .where(models.Assignment.id == assignment.id)
    )
    return assignment


@router.post("/requests/{request_id}/support", response_model=schemas.RequestDetail)
def support_request(request_id: int, payload: schemas.RequestSupportCreate, db: Session = Depends(get_db)):
    request_obj = db.scalar(
        select(models.Request)
        .options(
            selectinload(models.Request.skills),
            selectinload(models.Request.assignments).selectinload(models.Assignment.volunteer).selectinload(models.User.skills),
            selectinload(models.Request.support_votes),
        )
        .where(models.Request.id == request_id)
    )
    if not request_obj:
        raise HTTPException(status_code=404, detail="Request not found")
    if request_obj.status == "completed":
        raise HTTPException(status_code=400, detail="Completed requests cannot be supported")
    if request_obj.requester_id == payload.requester_id:
        raise HTTPException(status_code=400, detail="You cannot support your own request")

    requester = db.scalar(select(models.User).where(models.User.id == payload.requester_id, models.User.role == "requester"))
    if not requester:
        raise HTTPException(status_code=404, detail="Requester not found")

    distance_km = haversine_km(request_obj.lat, request_obj.lng, requester.lat, requester.lng)
    if distance_km > 10:
        raise HTTPException(status_code=400, detail="Requester is too far from this request")

    existing_vote = db.scalar(
        select(models.SupportVote).where(
            models.SupportVote.request_id == request_id,
            models.SupportVote.requester_id == payload.requester_id,
        )
    )
    if existing_vote:
        raise HTTPException(status_code=400, detail="Severity already supported from this account")

    vote = models.SupportVote(request_id=request_id, requester_id=payload.requester_id, points=max(payload.points, 1))
    db.add(vote)
    request_obj.severity_support_points += vote.points
    priority_score, priority_level = calculate_priority(
        request_obj.description,
        request_obj.people_count,
        [skill.name for skill in request_obj.skills],
        request_obj.cluster_boost + request_obj.severity_support_points,
    )
    request_obj.priority_score = priority_score
    request_obj.priority_level = priority_level
    db.add(request_obj)
    run_assignment(db, request_id, {assignment.volunteer_id for assignment in request_obj.assignments})
    update_request_status(db, request_obj)
    db.commit()

    refreshed = db.scalar(
        select(models.Request)
        .options(
            selectinload(models.Request.skills),
            selectinload(models.Request.assignments).selectinload(models.Assignment.volunteer).selectinload(models.User.skills),
            selectinload(models.Request.support_votes),
        )
        .where(models.Request.id == request_id)
    )
    return refreshed


@router.put("/requests/{request_id}/resolve", response_model=schemas.RequestDetail)
def resolve_request(request_id: int, payload: schemas.RequestResolvePayload, db: Session = Depends(get_db)):
    request_obj = db.scalar(
        select(models.Request)
        .options(
            selectinload(models.Request.skills),
            selectinload(models.Request.assignments).selectinload(models.Assignment.volunteer).selectinload(models.User.skills),
            selectinload(models.Request.support_votes),
        )
        .where(models.Request.id == request_id)
    )
    if not request_obj:
        raise HTTPException(status_code=404, detail="Request not found")
    if request_obj.requester_id != payload.requester_id:
        raise HTTPException(status_code=403, detail="Only the original requester can resolve this incident")

    for assignment in request_obj.assignments:
        if assignment.status != "completed":
            assignment.status = "completed"
            db.add(assignment)
        if assignment.volunteer:
            update_volunteer_status(assignment.volunteer, "completed")
            update_volunteer_status(assignment.volunteer, "available", availability=True)
            db.add(assignment.volunteer)

    request_obj.status = "completed"
    db.add(request_obj)
    db.commit()

    refreshed = db.scalar(
        select(models.Request)
        .options(
            selectinload(models.Request.skills),
            selectinload(models.Request.assignments).selectinload(models.Assignment.volunteer).selectinload(models.User.skills),
            selectinload(models.Request.support_votes),
        )
        .where(models.Request.id == request_id)
    )
    return refreshed
