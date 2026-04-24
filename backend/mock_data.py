"""
Mock data seeder for SEVAK.

Generates:
- 100 volunteers with random skills, ratings, locations (within 10km)
- 50 tasks (mix of DISASTER and NGO, different priorities)
- 20 assignments

All coordinates are within 10km of Bangalore central (12.9716, 77.5946).
"""
from __future__ import annotations

import math
import random
from datetime import datetime, timedelta

from sqlalchemy import select

CENTER_LAT = 12.9716
CENTER_LNG = 77.5946
RADIUS_KM = 10.0

FIRST_NAMES = [
    "Aarav", "Aditi", "Ananya", "Arjun", "Deepa", "Dhruv", "Farah", "Gautham",
    "Harini", "Imran", "Ishita", "Jagan", "Kavya", "Keerthi", "Lakshmi", "Manoj",
    "Meera", "Nikhil", "Nisha", "Omar", "Pooja", "Rahul", "Riya", "Sanjay",
    "Sneha", "Suresh", "Varun", "Vidya", "Vikram", "Yamini", "Aisha", "Bhavya",
    "Chetan", "Divya", "Ekta", "Farhan", "Gaurav", "Harsh", "Isha", "Jayesh",
    "Kriti", "Lavanya", "Mohit", "Nakul", "Pallavi", "Pranav", "Rohit", "Sakshi",
    "Tanvi", "Uma",
]

LAST_NAMES = [
    "Iyer", "Menon", "Reddy", "Nair", "Pillai", "Rao", "Kapoor", "Das",
    "Sen", "Bose", "Choudhury", "Kulkarni", "Patel", "Shah", "Thomas",
    "George", "Fernandes", "Khanna", "Verma", "Krishnan", "Sharma", "Gupta",
    "Singh", "Kumar", "Joshi", "Mehta", "Desai", "Banerjee", "Ghosh", "Agarwal",
]

SKILL_POOL = [
    "Medical", "Search and Rescue", "Swift Water Rescue", "Logistics",
    "Electrical", "Firefighting", "Paramedic", "Structural Rescue",
    "Shelter Management", "Communications", "First Aid", "CPR",
    "Crowd Control", "Food Distribution", "Counseling", "Translation",
    "Debris Removal", "Driving", "Water Supply", "IT Support",
]

DISASTER_TEMPLATES = [
    ("Medical Emergency", "Street medical triage needed", "Casualties reported near a busy junction; crowd control and medical triage required."),
    ("Flood Rescue", "Waterlogged lane with families stranded", "Waist-deep water in a residential pocket; elderly residents need evacuation support."),
    ("Structural Collapse", "Wall breach in commercial block", "Partial collapse after heavy rain; debris field may have trapped workers."),
    ("Power Failure", "Substation hazard and outage", "Transformer fault with exposed cabling; isolation and logistics for shelters required."),
    ("Urban Fire", "Smoke in multi-storey housing", "Smoke billowing from mid floors; possible trapped residents reported by neighbors."),
    ("Medical Emergency", "Heat exhaustion cluster at camp", "Large temporary shelter reports multiple heat exhaustion cases; fluids and medics needed."),
    ("Flood Rescue", "Canal overflow near slum lanes", "Fast rising water from canal breach; swift-water capable teams requested."),
    ("Earthquake Damage", "Building structural damage assessment", "Multiple buildings show cracks and tilting after tremors; structural engineers needed."),
]

NGO_TEMPLATES = [
    ("Supply Distribution", "Relief supply distribution point", "Distribution of food, water, and clothing at community center."),
    ("Shelter Management", "Temporary shelter setup needed", "Setting up and managing a temporary shelter for 200 displaced families."),
    ("Community Health", "Health camp organization", "Organizing a health check-up camp for flood-affected communities."),
    ("Education Support", "Mobile school for displaced children", "Setting up temporary education facility for children in relief camp."),
    ("Counseling", "Trauma counseling for survivors", "Psychological support and counseling sessions needed for disaster survivors."),
    ("Food Distribution", "Community kitchen management", "Running community kitchen serving 500+ meals daily at relief camp."),
    ("Water Supply", "Water purification and distribution", "Setting up water purification units and distribution at affected areas."),
    ("Documentation", "Relief registration and documentation", "Registering affected families and documenting relief needs."),
]

ASSIGNABLE_VOLUNTEER_IDS: set[int] = set()


def clear_assignable_volunteers() -> None:
    ASSIGNABLE_VOLUNTEER_IDS.clear()


def register_assignable_volunteer_id(volunteer_id: int) -> None:
    ASSIGNABLE_VOLUNTEER_IDS.add(int(volunteer_id))


def get_assignable_volunteer_ids() -> set[int]:
    return set(ASSIGNABLE_VOLUNTEER_IDS)


def random_point_within_radius_km(rng: random.Random, center_lat: float, center_lng: float, max_km: float) -> tuple[float, float]:
    u = rng.random()
    v = rng.random()
    r = max_km * math.sqrt(u)
    theta = 2 * math.pi * v
    dx_km = r * math.cos(theta)
    dy_km = r * math.sin(theta)
    d_lat = dy_km / 111.0
    d_lng = dx_km / (111.0 * math.cos(math.radians(center_lat)))
    return center_lat + d_lat, center_lng + d_lng


def _pick_skills(rng: random.Random, count: int | None = None) -> list[str]:
    k = count or rng.randint(1, 4)
    return rng.sample(SKILL_POOL, k=min(k, len(SKILL_POOL)))


def _pick_volunteer_status(rng: random.Random) -> tuple[str, bool]:
    roll = rng.random()
    if roll < 0.85:
        return "available", True
    if roll < 0.95:
        return "assigned", False
    return "en_route", False


def seed_simulation_dataset(db, models) -> None:
    """
    Populate skills, 100 volunteers, staff accounts, 50 tasks, and 20 assignments.
    """
    if db.scalar(select(models.User.id).limit(1)):
        return

    clear_assignable_volunteers()
    rng = random.Random(42)

    # ── Skills ──
    skills_by_name = {}
    for name in SKILL_POOL:
        skill = models.Skill(name=name)
        db.add(skill)
        db.flush()
        skills_by_name[name] = skill

    # ── 100 Volunteers ──
    volunteers = []
    for i in range(100):
        lat, lng = random_point_within_radius_km(rng, CENTER_LAT, CENTER_LNG, RADIUS_KM)
        status, availability = _pick_volunteer_status(rng)
        fname = rng.choice(FIRST_NAMES)
        lname = rng.choice(LAST_NAMES)
        rating = round(rng.uniform(2.5, 5.0), 2)
        workload = rng.randint(0, 3)

        user = models.User(
            name=f"{fname} {lname}",
            role="volunteer",
            lat=round(lat, 5),
            lng=round(lng, 5),
            availability=availability,
            status=status,
            phone=f"+91-{rng.randint(7000000000, 9999999999)}",
            rating=rating,
            workload=workload,
        )
        chosen = _pick_skills(rng)
        user.skills = [skills_by_name[s] for s in chosen]
        db.add(user)
        db.flush()
        register_assignable_volunteer_id(user.id)
        volunteers.append(user)

    # ── Staff accounts ──
    requester = models.User(
        name="Field Officer",
        role="requester",
        lat=CENTER_LAT,
        lng=CENTER_LNG,
        availability=False,
        status="available",
        phone="+91-requester-01",
    )
    admin = models.User(
        name="Command Admin",
        role="admin",
        lat=CENTER_LAT,
        lng=CENTER_LNG,
        availability=False,
        status="available",
        phone="+91-admin-01",
    )
    ngo_requester = models.User(
        name="NGO Coordinator",
        role="requester",
        lat=CENTER_LAT + 0.01,
        lng=CENTER_LNG + 0.01,
        availability=False,
        status="available",
        phone="+91-ngo-01",
    )
    db.add_all([requester, admin, ngo_requester])
    db.flush()

    # ── 50 Tasks (25 DISASTER + 25 NGO) ──
    now = datetime.utcnow()
    tasks = []

    for idx in range(25):
        inc_type, title, desc = rng.choice(DISASTER_TEMPLATES)
        lat, lng = random_point_within_radius_km(rng, CENTER_LAT, CENTER_LNG, RADIUS_KM)
        people = rng.randint(1, 40)
        skill_names = _pick_skills(rng, rng.randint(1, 3))

        priority_score = rng.randint(30, 100)
        if priority_score >= 88:
            priority_level = "CRITICAL"
        elif priority_score >= 75:
            priority_level = "HIGH"
        elif priority_score >= 50:
            priority_level = "MEDIUM"
        else:
            priority_level = "LOW"

        request_obj = models.Request(
            requester_id=requester.id,
            incident_type=inc_type,
            title=f"{title} (D-{idx+1})",
            description=desc,
            mode="DISASTER",
            lat=round(lat, 5),
            lng=round(lng, 5),
            people_count=people,
            status="pending",
            priority_score=priority_score,
            priority_level=priority_level,
            cluster_boost=rng.randint(0, 12),
            severity_support_points=0,
            image_url=None,
            image_verification_status="not_submitted",
            image_verification_reason="Seeded simulation request",
            created_at=now - timedelta(hours=rng.randint(0, 72), minutes=rng.randint(0, 59)),
        )
        request_obj.skills = [skills_by_name[s] for s in skill_names]
        db.add(request_obj)
        db.flush()
        tasks.append(request_obj)

    for idx in range(25):
        inc_type, title, desc = rng.choice(NGO_TEMPLATES)
        lat, lng = random_point_within_radius_km(rng, CENTER_LAT, CENTER_LNG, RADIUS_KM)
        people = rng.randint(5, 100)
        skill_names = _pick_skills(rng, rng.randint(1, 3))

        priority_score = rng.randint(20, 80)
        if priority_score >= 75:
            priority_level = "HIGH"
        elif priority_score >= 50:
            priority_level = "MEDIUM"
        else:
            priority_level = "LOW"

        request_obj = models.Request(
            requester_id=ngo_requester.id,
            incident_type=inc_type,
            title=f"{title} (N-{idx+1})",
            description=desc,
            mode="NGO",
            lat=round(lat, 5),
            lng=round(lng, 5),
            people_count=people,
            status="pending",
            priority_score=priority_score,
            priority_level=priority_level,
            cluster_boost=0,
            severity_support_points=0,
            image_url=None,
            image_verification_status="not_required",
            image_verification_reason="NGO mode - image not required",
            created_at=now - timedelta(hours=rng.randint(0, 120), minutes=rng.randint(0, 59)),
        )
        request_obj.skills = [skills_by_name[s] for s in skill_names]
        db.add(request_obj)
        db.flush()
        tasks.append(request_obj)

    db.flush()

    # ── 20 Assignments ──
    available_vols = [v for v in volunteers if v.availability]
    assigned_pairs = set()
    assignment_count = 0

    for _ in range(100):  # Try up to 100 times to get 20 unique assignments
        if assignment_count >= 20:
            break
        task = rng.choice(tasks[:30])  # Mostly assign to earlier tasks
        vol = rng.choice(available_vols[:50])  # Top 50 available volunteers
        pair = (task.id, vol.id)
        if pair in assigned_pairs:
            continue
        assigned_pairs.add(pair)

        score = round(rng.uniform(0.4, 0.95), 3)
        is_disaster = task.mode == "DISASTER"
        status = rng.choice(["accepted", "en_route", "on_task", "completed"])
        if not is_disaster:
            status = rng.choice(["pending_acceptance", "accepted", "completed"])

        assignment = models.Assignment(
            request_id=task.id,
            volunteer_id=vol.id,
            score=score,
            status=status,
            reason=f"Mock assignment; score={score}",
            created_at=task.created_at + timedelta(minutes=rng.randint(1, 30)),
        )
        db.add(assignment)

        if status in ("accepted", "en_route", "on_task"):
            vol.availability = False
            vol.status = "assigned" if status == "accepted" else status
            vol.workload = min(vol.workload + 1, 5)
            db.add(vol)

        if status == "completed":
            # Add a rating for completed assignments
            db.flush()
            rating = models.Rating(
                assignment_id=assignment.id,
                rating=rng.randint(3, 5),
                comment=rng.choice([
                    "Excellent work!", "Very responsive and helpful.",
                    "Good job, arrived quickly.", "Professional and caring.",
                    "Competent and efficient.", None
                ]),
            )
            db.add(rating)

        task.status = "assigned" if status != "completed" else "completed"
        db.add(task)
        assignment_count += 1

    db.flush()
