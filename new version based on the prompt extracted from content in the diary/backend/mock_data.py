"""
Simulation dataset for DisasterIQ.

All coordinates are generated within 50 km of Chennai central (13.0827, 80.2707).
Volunteers created here are tracked in ASSIGNABLE_VOLUNTEER_IDS so the assignment
engine can restrict selection to simulation responders only.
"""

from __future__ import annotations

import math
import random
from datetime import datetime, timedelta

from sqlalchemy import select

CHENNAI_LAT = 13.0827
CHENNAI_LNG = 80.2707
RADIUS_KM = 50.0

FIRST_NAMES = [
    "Aarav",
    "Aditi",
    "Ananya",
    "Arjun",
    "Deepa",
    "Dhruv",
    "Farah",
    "Gautham",
    "Harini",
    "Imran",
    "Ishita",
    "Jagan",
    "Kavya",
    "Keerthi",
    "Lakshmi",
    "Manoj",
    "Meera",
    "Nikhil",
    "Nisha",
    "Omar",
    "Pooja",
    "Rahul",
    "Riya",
    "Sanjay",
    "Sneha",
    "Suresh",
    "Varun",
    "Vidya",
    "Vikram",
    "Yamini",
]

LAST_NAMES = [
    "Iyer",
    "Menon",
    "Reddy",
    "Nair",
    "Pillai",
    "Rao",
    "Kapoor",
    "Das",
    "Sen",
    "Bose",
    "Choudhury",
    "Kulkarni",
    "Patel",
    "Shah",
    "Thomas",
    "George",
    "Fernandes",
    "Khanna",
    "Verma",
    "Krishnan",
]

SKILL_POOL = [
    "Medical",
    "Search and Rescue",
    "Swift Water Rescue",
    "Logistics",
    "Electrical",
    "Firefighting",
    "Paramedic",
    "Structural Rescue",
    "Shelter Management",
    "Communications",
]

INCIDENT_TEMPLATES = [
    ("Medical Emergency", "Street medical triage needed", "Casualties reported near a busy junction; crowd control and medical triage required."),
    ("Flood Rescue", "Waterlogged lane with families stranded", "Waist-deep water in a residential pocket; elderly residents need evacuation support."),
    ("Structural Collapse", "Wall breach in commercial block", "Partial collapse after heavy rain; debris field may have trapped workers."),
    ("Power Failure", "Substation hazard and outage", "Transformer fault with exposed cabling; isolation and logistics for shelters required."),
    ("Supply Distribution", "Relief queue overload", "Relief desk overwhelmed; crowd management and medical standby requested."),
    ("Urban Fire", "Smoke in multi-storey housing", "Smoke billowing from mid floors; possible trapped residents reported by neighbors."),
    ("Medical Emergency", "Heat exhaustion cluster at camp", "Large temporary shelter reports multiple heat exhaustion cases; fluids and medics needed."),
    ("Flood Rescue", "Canal overflow near slum lanes", "Fast rising water from canal breach; swift-water capable teams requested."),
]

# Populated during seed_simulation_dataset
ASSIGNABLE_VOLUNTEER_IDS: set[int] = set()


def clear_assignable_volunteers() -> None:
    ASSIGNABLE_VOLUNTEER_IDS.clear()


def register_assignable_volunteer_id(volunteer_id: int) -> None:
    ASSIGNABLE_VOLUNTEER_IDS.add(int(volunteer_id))


def get_assignable_volunteer_ids() -> set[int]:
    return set(ASSIGNABLE_VOLUNTEER_IDS)


def random_point_within_radius_km(rng: random.Random, center_lat: float, center_lng: float, max_km: float) -> tuple[float, float]:
    """Uniform-ish sampling within a circle (km) around center."""
    u = rng.random()
    v = rng.random()
    r = max_km * math.sqrt(u)
    theta = 2 * math.pi * v
    dx_km = r * math.cos(theta)
    dy_km = r * math.sin(theta)
    d_lat = dy_km / 111.0
    d_lng = dx_km / (111.0 * math.cos(math.radians(center_lat)))
    return center_lat + d_lat, center_lng + d_lng


def _pick_skills(rng: random.Random) -> list[str]:
    k = rng.randint(1, 3)
    return rng.sample(SKILL_POOL, k=k)


def _pick_volunteer_status(rng: random.Random) -> tuple[str, bool]:
    """Bias toward deployable responders so auto-assignment always has headroom."""
    roll = rng.random()
    if roll < 0.9:
        return "available", True
    if roll < 0.97:
        return "assigned", False
    return "en_route", False


def seed_simulation_dataset(db, models) -> None:
    """
    Populate skills, 120 simulation volunteers, default staff accounts, and 24 sample requests.
    Idempotent for empty DB only (matches prior seed_data behavior).
    """
    if db.scalar(select(models.User.id).limit(1)):
        return

    clear_assignable_volunteers()
    rng = random.Random(42)

    skills_by_name: dict[str, models.Skill] = {}
    for name in SKILL_POOL:
        skill = models.Skill(name=name)
        db.add(skill)
        db.flush()
        skills_by_name[name] = skill

    volunteers: list[models.User] = []
    for i in range(120):
        lat, lng = random_point_within_radius_km(rng, CHENNAI_LAT, CHENNAI_LNG, RADIUS_KM)
        status, availability = _pick_volunteer_status(rng)
        fname = rng.choice(FIRST_NAMES)
        lname = rng.choice(LAST_NAMES)
        user = models.User(
            name=f"Sim {fname} {lname} #{i+1}",
            role="volunteer",
            lat=round(lat, 5),
            lng=round(lng, 5),
            availability=availability,
            status=status,
            phone=f"sim-vol-{i+1:03d}",
        )
        chosen = _pick_skills(rng)
        user.skills = [skills_by_name[s] for s in chosen]
        db.add(user)
        db.flush()
        register_assignable_volunteer_id(user.id)
        volunteers.append(user)

    field_officer = models.User(
        name="Field Officer",
        role="requester",
        lat=CHENNAI_LAT,
        lng=CHENNAI_LNG,
        availability=False,
        status="available",
        phone="sim-requester-01",
    )
    admin = models.User(
        name="Command Admin",
        role="admin",
        lat=CHENNAI_LAT,
        lng=CHENNAI_LNG,
        availability=False,
        status="available",
        phone="sim-admin-01",
    )
    db.add_all([field_officer, admin])
    db.flush()

    now = datetime.utcnow()
    for idx in range(24):
        inc_type, title, desc = rng.choice(INCIDENT_TEMPLATES)
        lat, lng = random_point_within_radius_km(rng, CHENNAI_LAT, CHENNAI_LNG, RADIUS_KM)
        people = rng.randint(1, 40)
        skill_names = _pick_skills(rng)
        request_obj = models.Request(
            requester_id=field_officer.id,
            incident_type=inc_type,
            title=f"{title} ({idx+1})",
            description=desc,
            lat=round(lat, 5),
            lng=round(lng, 5),
            people_count=people,
            status="pending",
            priority_score=0,
            priority_level="LOW",
            cluster_boost=0,
            severity_support_points=0,
            image_url=None,
            image_verification_status="not_submitted",
            image_verification_reason="Seeded simulation request",
            created_at=now - timedelta(hours=rng.randint(0, 72), minutes=rng.randint(0, 59)),
        )
        request_obj.skills = [skills_by_name[s] for s in skill_names]
        db.add(request_obj)

    db.flush()
