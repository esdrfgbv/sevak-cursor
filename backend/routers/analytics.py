from collections import Counter
from datetime import datetime

from fastapi import APIRouter

import schemas
from firebase_service import get_all_assignments, get_requests, get_users
from models import request_from_dict, user_from_dict, assignment_from_dict
from services.gemini_service import generate_dashboard_insight

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


def _insight_snapshot() -> dict:
    volunteers = [user_from_dict(v) for v in get_users(role="volunteer")]
    requests = [request_from_dict(r) for r in get_requests()]

    total_volunteers = len(volunteers)
    available_volunteers = sum(1 for v in volunteers if v.availability)
    
    active_tasks = sum(1 for r in requests if r.status != "completed")
    critical_tasks = sum(1 for r in requests if r.priority_level in ["HIGH", "CRITICAL"])
    
    return {
        "active_tasks": active_tasks,
        "critical_tasks": critical_tasks,
        "available_volunteers": available_volunteers,
        "total_volunteers": total_volunteers,
    }


@router.get("/dashboard/insight", response_model=schemas.DashboardInsightResponse)
def dashboard_insight():
    return {"insight": generate_dashboard_insight(_insight_snapshot())}


@router.get("/dashboard", response_model=schemas.DashboardAnalytics)
def dashboard_analytics():
    volunteers = [user_from_dict(v) for v in get_users(role="volunteer")]
    requests = [request_from_dict(r) for r in get_requests()]
    
    total_tasks = len(requests)
    active_tasks = sum(1 for r in requests if r.status != "completed")
    completed_tasks = sum(1 for r in requests if r.status == "completed")
    
    total_volunteers = len(volunteers)
    available_volunteers = sum(1 for v in volunteers if v.availability)
    
    disaster_tasks = sum(1 for r in requests if (r.mode or "DISASTER").upper() == "DISASTER")
    ngo_tasks = sum(1 for r in requests if (r.mode or "").upper() == "NGO")
    critical_tasks = sum(1 for r in requests if r.priority_level in ["HIGH", "CRITICAL"])

    # Tasks by status
    tasks_by_status = {}
    for status in ["pending", "assigned", "completed"]:
        tasks_by_status[status] = sum(1 for r in requests if r.status == status)

    # Tasks by priority
    tasks_by_priority = {}
    for level in ["LOW", "MEDIUM", "HIGH", "CRITICAL"]:
        tasks_by_priority[level] = sum(1 for r in requests if r.priority_level == level)

    # Tasks by mode
    tasks_by_mode = {"DISASTER": disaster_tasks, "NGO": ngo_tasks}

    # Completion rate
    completion_rate = (completed_tasks / total_tasks * 100) if total_tasks > 0 else 0

    # Average response time (simulated)
    avg_response_time = 12.5

    # Recent activity
    all_assignments = [assignment_from_dict(a) for a in get_all_assignments(include_volunteer=True)]
    from datetime import timezone
    all_assignments.sort(key=lambda a: a.created_at or datetime.min.replace(tzinfo=timezone.utc), reverse=True)
    recent_assignments = all_assignments[:10]

    recent_activity = []
    for a in recent_assignments:
        volunteer_name = a.volunteer.name if a.volunteer else 'Unknown'
        
        request_title = 'Unknown'
        # To get the request title, we'd need the request object.
        req_match = next((r for r in requests if r.id == a.request_id), None)
        if req_match:
            request_title = req_match.title

        recent_activity.append({
            "type": "assignment",
            "message": f"{volunteer_name} assigned to {request_title}",
            "status": a.status,
            "score": a.score,
            "time": a.created_at.isoformat() if a.created_at else "",
        })

    insight_snapshot = {
        "active_tasks": active_tasks,
        "critical_tasks": critical_tasks,
        "available_volunteers": available_volunteers,
        "total_volunteers": total_volunteers,
        "completion_rate": round(completion_rate, 1),
        "tasks_by_priority": tasks_by_priority,
        "tasks_by_mode": tasks_by_mode,
    }

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
        ai_insight=generate_dashboard_insight(insight_snapshot),
        recent_activity=recent_activity,
    )


@router.get("/heatmap", response_model=list[schemas.HeatmapPoint])
def heatmap():
    requests = [request_from_dict(r) for r in get_requests()]
    active_requests = [r for r in requests if r.status != "completed"]

    points = []
    for task in active_requests:
        intensity = task.priority_score / 100.0
        points.append(schemas.HeatmapPoint(
            lat=task.lat,
            lng=task.lng,
            intensity=round(intensity, 2),
            label=f"{task.title} ({task.priority_level})",
        ))
    return points


@router.get("/volunteer-performance", response_model=list[schemas.VolunteerPerformance])
def volunteer_performance():
    volunteers = [user_from_dict(v) for v in get_users(role="volunteer")]
    volunteers.sort(key=lambda v: v.rating, reverse=True)
    
    # We need to map assignments to volunteers to count completed ones
    all_assignments = [assignment_from_dict(a) for a in get_all_assignments(include_volunteer=False)]

    results = []
    for vol in volunteers[:50]:
        vol_assignments = [a for a in all_assignments if str(a.volunteer_id) == str(vol.id)]
        completed = sum(1 for a in vol_assignments if a.status == "completed")
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
def skill_demand():
    requests = [request_from_dict(r) for r in get_requests()]
    active_requests = [r for r in requests if r.status != "completed"]

    demand_counter: Counter = Counter()
    for task in active_requests:
        for skill in task.skills:
            demand_counter[skill.name] += 1

    volunteers = [user_from_dict(v) for v in get_users(role="volunteer")]
    available_vols = [v for v in volunteers if v.availability]

    supply_counter: Counter = Counter()
    for vol in available_vols:
        for skill in vol.skills:
            supply_counter[skill.name] += 1

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
