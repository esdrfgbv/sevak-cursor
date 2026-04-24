"""Analytics router with /api/analytics/ prefix."""
from collections import Counter
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from .. import models, schemas
from ..database import get_db

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


@router.get("/dashboard", response_model=schemas.DashboardAnalytics)
def dashboard_analytics(db: Session = Depends(get_db)):
    total_tasks = db.scalar(select(func.count(models.Request.id))) or 0
    active_tasks = db.scalar(
        select(func.count(models.Request.id)).where(models.Request.status != "completed")
    ) or 0
    completed_tasks = db.scalar(
        select(func.count(models.Request.id)).where(models.Request.status == "completed")
    ) or 0
    total_volunteers = db.scalar(
        select(func.count(models.User.id)).where(models.User.role == "volunteer")
    ) or 0
    available_volunteers = db.scalar(
        select(func.count(models.User.id)).where(
            models.User.role == "volunteer", models.User.availability == True
        )
    ) or 0
    disaster_tasks = db.scalar(
        select(func.count(models.Request.id)).where(models.Request.mode == "DISASTER")
    ) or 0
    ngo_tasks = db.scalar(
        select(func.count(models.Request.id)).where(models.Request.mode == "NGO")
    ) or 0
    critical_tasks = db.scalar(
        select(func.count(models.Request.id)).where(
            models.Request.priority_level.in_(["HIGH", "CRITICAL"])
        )
    ) or 0

    # Tasks by status
    tasks_by_status = {}
    for status in ["pending", "assigned", "completed"]:
        count = db.scalar(
            select(func.count(models.Request.id)).where(models.Request.status == status)
        ) or 0
        tasks_by_status[status] = count

    # Tasks by priority
    tasks_by_priority = {}
    for level in ["LOW", "MEDIUM", "HIGH", "CRITICAL"]:
        count = db.scalar(
            select(func.count(models.Request.id)).where(models.Request.priority_level == level)
        ) or 0
        tasks_by_priority[level] = count

    # Tasks by mode
    tasks_by_mode = {"DISASTER": disaster_tasks, "NGO": ngo_tasks}

    # Completion rate
    completion_rate = (completed_tasks / total_tasks * 100) if total_tasks > 0 else 0

    # Average response time (simulated)
    avg_response_time = 12.5

    # Recent activity
    recent_assignments = db.scalars(
        select(models.Assignment)
        .options(
            selectinload(models.Assignment.volunteer),
            selectinload(models.Assignment.request),
        )
        .order_by(models.Assignment.created_at.desc())
        .limit(10)
    ).all()

    recent_activity = []
    for a in recent_assignments:
        recent_activity.append({
            "type": "assignment",
            "message": f"{a.volunteer.name if a.volunteer else 'Unknown'} assigned to {a.request.title if a.request else 'Unknown'}",
            "status": a.status,
            "score": a.score,
            "time": a.created_at.isoformat() if a.created_at else "",
        })

    return schemas.DashboardAnalytics(
        total_tasks=total_tasks,
        active_tasks=active_tasks,
        completed_tasks=completed_tasks,
        total_volunteers=total_volunteers,
        available_volunteers=available_volunteers,
        disaster_tasks=disaster_tasks,
        ngo_tasks=ngo_tasks,
        critical_tasks=critical_tasks,
        avg_response_time_min=avg_response_time,
        completion_rate=round(completion_rate, 1),
        tasks_by_status=tasks_by_status,
        tasks_by_priority=tasks_by_priority,
        tasks_by_mode=tasks_by_mode,
        recent_activity=recent_activity,
    )


@router.get("/heatmap", response_model=list[schemas.HeatmapPoint])
def heatmap(db: Session = Depends(get_db)):
    tasks = db.scalars(
        select(models.Request).where(models.Request.status != "completed")
    ).all()

    points = []
    for task in tasks:
        intensity = task.priority_score / 100.0
        points.append(schemas.HeatmapPoint(
            lat=task.lat,
            lng=task.lng,
            intensity=round(intensity, 2),
            label=f"{task.title} ({task.priority_level})",
        ))
    return points


@router.get("/volunteer-performance", response_model=list[schemas.VolunteerPerformance])
def volunteer_performance(db: Session = Depends(get_db)):
    volunteers = db.scalars(
        select(models.User)
        .options(selectinload(models.User.skills), selectinload(models.User.volunteer_assignments))
        .where(models.User.role == "volunteer")
        .order_by(models.User.rating.desc())
        .limit(50)
    ).all()

    results = []
    for vol in volunteers:
        completed = sum(1 for a in vol.volunteer_assignments if a.status == "completed")
        total = len(vol.volunteer_assignments) if vol.volunteer_assignments else 0
        avail_rate = 1.0 if vol.availability else 0.5

        results.append(schemas.VolunteerPerformance(
            volunteer_id=vol.id,
            name=vol.name,
            tasks_completed=completed,
            avg_rating=vol.rating or 0.0,
            availability_rate=round(avail_rate, 2),
            skills=[s.name for s in vol.skills],
        ))

    return results


@router.get("/skill-demand", response_model=list[schemas.SkillDemandItem])
def skill_demand(db: Session = Depends(get_db)):
    # Demand: count how many active tasks require each skill
    active_tasks = db.scalars(
        select(models.Request)
        .options(selectinload(models.Request.skills))
        .where(models.Request.status != "completed")
    ).all()

    demand_counter: Counter = Counter()
    for task in active_tasks:
        for skill in task.skills:
            demand_counter[skill.name] += 1

    # Supply: count how many available volunteers have each skill
    available_vols = db.scalars(
        select(models.User)
        .options(selectinload(models.User.skills))
        .where(models.User.role == "volunteer", models.User.availability == True)
    ).all()

    supply_counter: Counter = Counter()
    for vol in available_vols:
        for skill in vol.skills:
            supply_counter[skill.name] += 1

    # Combine all skill names
    all_skills = set(demand_counter.keys()) | set(supply_counter.keys())
    results = []
    for skill_name in sorted(all_skills):
        d = demand_counter.get(skill_name, 0)
        s = supply_counter.get(skill_name, 0)
        results.append(schemas.SkillDemandItem(
            skill=skill_name,
            demand=d,
            supply=s,
            gap=d - s,
        ))

    return sorted(results, key=lambda x: x.gap, reverse=True)
