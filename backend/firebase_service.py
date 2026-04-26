"""
Firebase Firestore service layer for SEVAK.
Single source of truth replacing SQLAlchemy/SQLite.
"""
from __future__ import annotations

import math
import random
from datetime import datetime
from typing import Any

import firebase_admin
from firebase_admin import credentials, firestore

import config

# ── Constants ─────────────────────────────────────────────────────────────────
BASE_LAT = 17.3850
BASE_LNG = 78.4867
DEMO_RADIUS_KM = float(getattr(config, "DEMO_RADIUS_KM", 20))

SKILL_POOL = [
    "Medical", "Search and Rescue", "Swift Water Rescue", "Logistics",
    "Electrical", "Firefighting", "Paramedic", "Structural Rescue",
    "Shelter Management", "Communications", "First Aid", "CPR",
    "Crowd Control", "Food Distribution", "Counseling", "Translation",
    "Debris Removal", "Driving", "Water Supply", "IT Support",
]

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

DISASTER_TEMPLATES = [
    ("Medical Emergency", "Street medical triage needed", "Casualties reported near a busy junction; crowd control and medical triage required."),
    ("Flood Rescue", "Waterlogged lane with families stranded", "Waist-deep water in a residential pocket; elderly residents need evacuation support."),
    ("Structural Collapse", "Wall breach in commercial block", "Partial collapse after heavy rain; debris field may have trapped workers."),
    ("Power Failure", "Substation hazard and outage", "Transformer fault with exposed cabling; isolation and logistics required."),
    ("Urban Fire", "Smoke in multi-storey housing", "Smoke billowing from mid floors; possible trapped residents reported."),
    ("Flood Rescue", "Canal overflow near slum lanes", "Fast rising water from canal breach; swift-water teams requested."),
    ("Earthquake Damage", "Building structural damage assessment", "Multiple buildings show cracks after tremors; structural engineers needed."),
    ("Medical Emergency", "Heat exhaustion cluster at camp", "Large shelter reports multiple heat exhaustion cases; medics needed urgently."),
]

NGO_TEMPLATES = [
    ("Supply Distribution", "Relief supply distribution point", "Distribution of food, water, and clothing at community center."),
    ("Shelter Management", "Temporary shelter setup needed", "Setting up shelter for 200 displaced families."),
    ("Community Health", "Health camp organization", "Organizing health check-up camp for flood-affected communities."),
    ("Food Distribution", "Community kitchen management", "Running community kitchen serving 500+ meals daily."),
    ("Water Supply", "Water purification and distribution", "Setting up water purification units at affected areas."),
    ("Counseling", "Trauma counseling for survivors", "Psychological support sessions needed for disaster survivors."),
    ("Education Support", "Mobile school for displaced children", "Temporary education facility for children in relief camp."),
    ("Documentation", "Relief registration", "Registering affected families and documenting relief needs."),
]

# ── Singleton ─────────────────────────────────────────────────────────────────
_db_client = None


def init_firebase() -> None:
    """Initialize Firebase Admin SDK (idempotent)."""
    global _db_client
    if _db_client is not None:
        return
    creds_path = getattr(config, "FIREBASE_CREDENTIALS_PATH", None)
    if creds_path and not firebase_admin._apps:
        cred = credentials.Certificate(creds_path)
        firebase_admin.initialize_app(cred)
    elif not firebase_admin._apps:
        firebase_admin.initialize_app()
    _db_client = firestore.client()


def _db():
    if _db_client is None:
        init_firebase()
    return _db_client


# ── Location ──────────────────────────────────────────────────────────────────
def generate_nearby_location(max_km: float = 18.0) -> tuple[float, float]:
    """Return (lat, lng) within max_km of Hyderabad base."""
    u = random.random()
    v = random.random()
    r_deg = (max_km / 111.0) * math.sqrt(u)
    theta = 2 * math.pi * v
    lat = BASE_LAT + r_deg * math.sin(theta)
    lng = BASE_LNG + r_deg * math.cos(theta) / math.cos(math.radians(BASE_LAT))
    return round(lat, 5), round(lng, 5)


def _stable_demo_location(seed_key: str, max_km: float = DEMO_RADIUS_KM) -> tuple[float, float]:
    """Deterministic point within max_km of the demo center."""
    rng = random.Random(seed_key)
    u = rng.random()
    v = rng.random()
    r_deg = (max_km / 111.0) * math.sqrt(u)
    theta = 2 * math.pi * v
    lat = float(config.BASE_LAT) + r_deg * math.sin(theta)
    lng = float(config.BASE_LNG) + r_deg * math.cos(theta) / math.cos(math.radians(float(config.BASE_LAT)))
    return round(lat, 5), round(lng, 5)


def _apply_demo_location(entity_type: str, entity_id: Any, lat: Any, lng: Any) -> tuple[float, float]:
    """
    Critical demo rule: force all entities to appear within DEMO_RADIUS_KM of the fixed center.
    We keep it deterministic per-entity for stable demos.
    """
    try:
        _ = float(lat)
        _ = float(lng)
    except Exception:
        pass
    return _stable_demo_location(f"{entity_type}:{entity_id}", max_km=DEMO_RADIUS_KM)


# ── Counter ───────────────────────────────────────────────────────────────────
def _next_id(collection: str) -> int:
    """Thread-safe auto-increment ID via Firestore transaction."""
    db = _db()
    counter_ref = db.collection("_meta").document("counters")

    @firestore.transactional
    def _txn(transaction, ref):
        snap = ref.get(transaction=transaction)
        current = (snap.to_dict().get(collection) or 0) if snap.exists else 0
        new_val = current + 1
        transaction.set(ref, {collection: new_val}, merge=True)
        return new_val

    return _txn(db.transaction(), counter_ref)


# ── Timestamp helper ──────────────────────────────────────────────────────────
def _ts(val) -> datetime:
    if val is None:
        return datetime.utcnow()
    if hasattr(val, "seconds"):  # Firestore Timestamp
        return val.ToDatetime()
    if isinstance(val, datetime):
        return val
    return datetime.utcnow()


# ═══════════════════════════ USERS ════════════════════════════════════════════

def _user_from_doc(doc) -> dict:
    d = doc.to_dict()
    d["id"] = d.get("id", 0)
    d["created_at"] = _ts(d.get("created_at"))
    d.setdefault("skills", [])
    d.setdefault("availability", True)
    d.setdefault("status", "available")
    d.setdefault("rating", 0.0)
    d.setdefault("workload", 0)
    d.setdefault("phone", None)
    d["lat"], d["lng"] = _apply_demo_location("user", d.get("id", 0), d.get("lat"), d.get("lng"))
    return d


def get_users(role: str | None = None) -> list[dict]:
    db = _db()
    q = db.collection("users")
    if role:
        q = q.where("role", "==", role)
    return [_user_from_doc(d) for d in q.stream()]


def get_user_by_id(user_id: int) -> dict | None:
    for d in _db().collection("users").where("id", "==", user_id).limit(1).stream():
        return _user_from_doc(d)
    return None


def get_user_by_name(name: str) -> dict | None:
    for d in _db().collection("users").where("name", "==", name).limit(1).stream():
        return _user_from_doc(d)
    return None


def _user_doc_ref(user_id: int):
    docs = list(_db().collection("users").where("id", "==", user_id).limit(1).stream())
    return docs[0].reference if docs else None


def create_user(data: dict) -> dict:
    uid = _next_id("users")
    lat, lng = _apply_demo_location("user", uid, data.get("lat", BASE_LAT), data.get("lng", BASE_LNG))
    doc = {
        "id": uid,
        "name": data.get("name", ""),
        "role": data.get("role", "volunteer"),
        "lat": lat,
        "lng": lng,
        "availability": data.get("availability", True),
        "status": data.get("status", "available"),
        "phone": data.get("phone"),
        "rating": data.get("rating", 0.0),
        "workload": data.get("workload", 0),
        "skills": data.get("skills", []),
        "created_at": datetime.utcnow(),
    }
    _db().collection("users").document().set(doc)
    doc["created_at"] = doc["created_at"]
    return doc


def update_user(user_id: int, updates: dict) -> dict | None:
    ref = _user_doc_ref(user_id)
    if not ref:
        return None
    safe = {k: v for k, v in updates.items()}
    if "lat" in safe or "lng" in safe:
        lat, lng = _apply_demo_location("user", user_id, safe.get("lat"), safe.get("lng"))
        safe["lat"] = lat
        safe["lng"] = lng
    ref.update(safe)
    return _user_from_doc(ref.get())


# ═══════════════════════════ SKILLS ═══════════════════════════════════════════

def ensure_skill(name: str) -> dict:
    for d in _db().collection("skills").where("name", "==", name).limit(1).stream():
        dd = d.to_dict()
        return {"id": dd.get("id", 0), "name": dd.get("name", name)}
    sid = _next_id("skills")
    doc = {"id": sid, "name": name}
    _db().collection("skills").document().set(doc)
    return doc


def ensure_skills(names: list[str]) -> dict[str, dict]:
    return {n: ensure_skill(n) for n in names}


def get_skills() -> list[dict]:
    return [{"id": d.to_dict().get("id", 0), "name": d.to_dict().get("name", "")}
            for d in _db().collection("skills").stream()]


# ═══════════════════════════ REQUESTS ═════════════════════════════════════════

def _request_from_doc(doc, include_assignments: bool = True, include_support_votes: bool = True) -> dict:
    d = doc.to_dict()
    d["id"] = d.get("id", 0)
    d["created_at"] = _ts(d.get("created_at"))
    d.setdefault("required_skills", [])
    d.setdefault("cluster_boost", 0)
    d.setdefault("severity_support_points", 0)
    d.setdefault("image_url", None)
    d.setdefault("image_verification_status", "not_submitted")
    d.setdefault("image_verification_reason", None)
    d.setdefault("ai_insight", None)
    d.setdefault("priority_score", 0)
    d.setdefault("priority_level", "LOW")
    d.setdefault("people_count", 0)
    d.setdefault("mode", "DISASTER")
    d.setdefault("status", "pending")
    d.setdefault("requester_id", None)
    d["lat"], d["lng"] = _apply_demo_location("request", d.get("id", 0), d.get("lat"), d.get("lng"))
    d["support_votes"] = get_support_votes(d["id"]) if include_support_votes else []
    d["assignments"] = get_assignments(request_id=d["id"], include_volunteer=False) if include_assignments else []
    return d


def get_requests(mode: str | None = None, status: str | None = None, include_assignments: bool = False, include_support_votes: bool = False) -> list[dict]:
    docs = _db().collection("requests").stream()
    out = []
    for doc in docs:
        r = _request_from_doc(doc, include_assignments=include_assignments, include_support_votes=include_support_votes)
        if mode and r.get("mode") != mode.upper():
            continue
        if status and r.get("status") != status:
            continue
        out.append(r)
    
    # Sort in Python by created_at descending
    from datetime import datetime, timezone
    out.sort(key=lambda x: x.get("created_at") or datetime.min.replace(tzinfo=timezone.utc), reverse=True)
    return out


def get_request_by_id(request_id: int) -> dict | None:
    docs = list(_db().collection("requests").where("id", "==", request_id).limit(1).stream())
    return _request_from_doc(docs[0]) if docs else None


def _request_doc_ref(request_id: int):
    docs = list(_db().collection("requests").where("id", "==", request_id).limit(1).stream())
    return docs[0].reference if docs else None


def create_request(data: dict) -> dict:
    rid = _next_id("requests")
    lat, lng = _apply_demo_location("request", rid, data.get("lat", BASE_LAT), data.get("lng", BASE_LNG))
    doc = {
        "id": rid,
        "requester_id": data.get("requester_id"),
        "incident_type": data.get("incident_type", ""),
        "title": data.get("title", ""),
        "description": data.get("description", ""),
        "mode": data.get("mode", "DISASTER"),
        "lat": lat,
        "lng": lng,
        "people_count": data.get("people_count", 0),
        "status": data.get("status", "pending"),
        "priority_score": data.get("priority_score", 0),
        "priority_level": data.get("priority_level", "LOW"),
        "cluster_boost": data.get("cluster_boost", 0),
        "severity_support_points": data.get("severity_support_points", 0),
        "ai_insight": data.get("ai_insight"),
        "image_url": data.get("image_url"),
        "image_verification_status": data.get("image_verification_status", "not_submitted"),
        "image_verification_reason": data.get("image_verification_reason"),
        "required_skills": data.get("required_skills", []),
        "created_at": datetime.utcnow(),
    }
    _db().collection("requests").document().set(doc)
    result = dict(doc)
    result["assignments"] = []
    result["support_votes"] = []
    return result


def update_request(request_id: int, updates: dict) -> dict | None:
    ref = _request_doc_ref(request_id)
    if not ref:
        return None
    safe = {k: v for k, v in updates.items()}
    if "lat" in safe or "lng" in safe:
        lat, lng = _apply_demo_location("request", request_id, safe.get("lat"), safe.get("lng"))
        safe["lat"] = lat
        safe["lng"] = lng
    ref.update(safe)
    return _request_from_doc(ref.get())


# ═══════════════════════════ ASSIGNMENTS ══════════════════════════════════════

def _assignment_from_doc(doc, include_volunteer: bool = True) -> dict:
    d = doc.to_dict()
    d["id"] = d.get("id", 0)
    d["created_at"] = _ts(d.get("created_at"))
    d.setdefault("status", "accepted")
    d.setdefault("score", 0.0)
    d.setdefault("reason", "")
    vid = d.get("volunteer_id")
    d["volunteer"] = get_user_by_id(vid) if vid and include_volunteer else None
    return d


def get_assignments(request_id: Union[int, str] | None = None, volunteer_id: Union[int, str] | None = None, include_volunteer: bool = True) -> list[dict]:
    q = _db().collection("assignments")
    if request_id is not None:
        q = q.where("request_id", "==", request_id)
    if volunteer_id is not None:
        q = q.where("volunteer_id", "==", volunteer_id)
    return [_assignment_from_doc(d, include_volunteer=include_volunteer) for d in q.stream()]


def get_all_assignments(include_volunteer: bool = False) -> list[dict]:
    assignments = [_assignment_from_doc(d, include_volunteer=False) for d in _db().collection("assignments").stream()]
    if include_volunteer:
        # Bulk fetch users and map by ID (stringified for safety)
        users_map = {str(u["id"]): u for u in get_users()}
        for a in assignments:
            vid = a.get("volunteer_id")
            if vid:
                a["volunteer"] = users_map.get(str(vid))
    return assignments


def get_assignment_by_id(assignment_id: int) -> dict | None:
    docs = list(_db().collection("assignments").where("id", "==", assignment_id).limit(1).stream())
    return _assignment_from_doc(docs[0], include_volunteer=True) if docs else None


def _assignment_doc_ref(assignment_id: int):
    docs = list(_db().collection("assignments").where("id", "==", assignment_id).limit(1).stream())
    return docs[0].reference if docs else None


def create_assignment(data: dict) -> dict:
    aid = _next_id("assignments")
    doc = {
        "id": aid,
        "request_id": data.get("request_id"),
        "volunteer_id": data.get("volunteer_id"),
        "score": data.get("score", 0.0),
        "status": data.get("status", "accepted"),
        "reason": data.get("reason", ""),
        "created_at": datetime.utcnow(),
    }
    _db().collection("assignments").document().set(doc)
    result = dict(doc)
    result["volunteer"] = get_user_by_id(data.get("volunteer_id"))
    return result


def update_assignment(assignment_id: int, updates: dict) -> dict | None:
    ref = _assignment_doc_ref(assignment_id)
    if not ref:
        return None
    ref.update(updates)
    return _assignment_from_doc(ref.get())


# ═══════════════════════════ RATINGS ══════════════════════════════════════════

def create_rating(data: dict) -> dict:
    rid = _next_id("ratings")
    doc = {
        "id": rid,
        "assignment_id": data.get("assignment_id"),
        "rating": data.get("rating", 0),
        "comment": data.get("comment"),
        "created_at": datetime.utcnow(),
    }
    _db().collection("ratings").document().set(doc)
    return doc


def get_rating_by_assignment(assignment_id: int) -> dict | None:
    docs = list(_db().collection("ratings").where("assignment_id", "==", assignment_id).limit(1).stream())
    if not docs:
        return None
    d = docs[0].to_dict()
    d["created_at"] = _ts(d.get("created_at"))
    return d


def get_ratings_for_volunteer(volunteer_id: int) -> list[dict]:
    assignment_ids = [a["id"] for a in get_assignments(volunteer_id=volunteer_id)]
    ratings = []
    for aid in assignment_ids:
        docs = _db().collection("ratings").where("assignment_id", "==", aid).stream()
        for doc in docs:
            d = doc.to_dict()
            d["created_at"] = _ts(d.get("created_at"))
            ratings.append(d)
    return ratings


# ═══════════════════════════ SUPPORT VOTES ════════════════════════════════════

def add_support_vote(request_id: int, requester_id: int, points: int = 10) -> bool:
    docs = list(_db().collection("support_votes")
                .where("request_id", "==", request_id)
                .where("requester_id", "==", requester_id).limit(1).stream())
    if docs:
        return False
    vid = _next_id("support_votes")
    _db().collection("support_votes").document().set({
        "id": vid, "request_id": request_id, "requester_id": requester_id,
        "points": points, "created_at": datetime.utcnow(),
    })
    return True


def get_support_votes(request_id: Union[int, str]) -> list[dict]:
    docs = _db().collection("support_votes").where("request_id", "==", request_id).stream()
    return [d.to_dict() for d in docs]


def get_all_support_votes() -> list[dict]:
    return [d.to_dict() for d in _db().collection("support_votes").stream()]


# ═══════════════════════════ REQUEST STATUS ════════════════════════════════════

def sync_request_status(request_id: int) -> str:
    """Compute and persist correct request status from its assignments."""
    assignments = get_assignments(request_id=request_id)
    active_statuses = {"pending_acceptance", "accepted", "en_route", "on_task"}
    has_active = any(a["status"] in active_statuses for a in assignments)
    has_completed = any(a["status"] == "completed" for a in assignments)

    if has_completed and not has_active:
        new_status = "completed"
    elif has_active:
        new_status = "assigned"
    else:
        new_status = "pending"

    update_request(request_id, {"status": new_status})
    return new_status


# ═══════════════════════════ SEEDER ═══════════════════════════════════════════

def seed_if_empty() -> None:
    """Populate Firestore with 50 volunteers + 20 requests if empty."""
    existing = list(_db().collection("users").limit(1).stream())
    if existing:
        print("[SEVAK] Firebase already seeded.")
        return

    print("[SEVAK] Seeding Firebase with demo data…")
    rng = random.Random(42)

    # Skills
    for name in SKILL_POOL:
        sid = _next_id("skills")
        _db().collection("skills").document().set({"id": sid, "name": name})

    # Staff accounts
    admin_id = _next_id("users")
    _db().collection("users").document().set({
        "id": admin_id, "name": "Command Admin", "role": "admin",
        "lat": BASE_LAT, "lng": BASE_LNG,
        "availability": False, "status": "available",
        "phone": "+91-9000000001", "rating": 5.0, "workload": 0,
        "skills": [], "created_at": datetime.utcnow(),
    })
    requester_id = _next_id("users")
    _db().collection("users").document().set({
        "id": requester_id, "name": "Field Officer", "role": "requester",
        "lat": BASE_LAT + 0.003, "lng": BASE_LNG + 0.003,
        "availability": False, "status": "available",
        "phone": "+91-9000000002", "rating": 4.5, "workload": 0,
        "skills": [], "created_at": datetime.utcnow(),
    })
    ngo_id = _next_id("users")
    _db().collection("users").document().set({
        "id": ngo_id, "name": "NGO Coordinator", "role": "requester",
        "lat": BASE_LAT + 0.005, "lng": BASE_LNG - 0.005,
        "availability": False, "status": "available",
        "phone": "+91-9000000003", "rating": 4.8, "workload": 0,
        "skills": [], "created_at": datetime.utcnow(),
    })

    # 50 Volunteers
    vol_ids = []
    for i in range(50):
        lat, lng = generate_nearby_location(max_km=18)
        fname = rng.choice(FIRST_NAMES)
        lname = rng.choice(LAST_NAMES)
        skills = rng.sample(SKILL_POOL, k=rng.randint(1, 4))
        rating = round(rng.uniform(2.5, 5.0), 2)
        workload = rng.randint(0, 3)
        if i < 35:
            status, avail = "available", True
        elif i < 45:
            status, avail = "assigned", False
        else:
            status, avail = "en_route", False
        uid = _next_id("users")
        _db().collection("users").document().set({
            "id": uid, "name": f"{fname} {lname}", "role": "volunteer",
            "lat": lat, "lng": lng, "availability": avail, "status": status,
            "phone": f"+91-{rng.randint(7000000000, 9999999999)}",
            "rating": rating, "workload": workload, "skills": skills,
            "created_at": datetime.utcnow(),
        })
        vol_ids.append(uid)

    # 20 Requests (10 DISASTER + 10 NGO)
    req_ids = []
    from datetime import timedelta
    now = datetime.utcnow()

    for idx in range(10):
        inc_type, title, desc = rng.choice(DISASTER_TEMPLATES)
        lat, lng = generate_nearby_location(max_km=18)
        people = rng.randint(1, 40)
        skills = rng.sample(SKILL_POOL, k=rng.randint(1, 3))
        pscore = rng.randint(30, 100)
        plevel = "CRITICAL" if pscore >= 88 else "HIGH" if pscore >= 75 else "MEDIUM" if pscore >= 50 else "LOW"
        rid = _next_id("requests")
        _db().collection("requests").document().set({
            "id": rid, "requester_id": requester_id,
            "incident_type": inc_type, "title": f"{title} (D-{idx+1})", "description": desc,
            "mode": "DISASTER", "lat": lat, "lng": lng, "people_count": people,
            "status": "pending", "priority_score": pscore, "priority_level": plevel,
            "cluster_boost": rng.randint(0, 12), "severity_support_points": 0,
            "ai_insight": None, "image_url": None,
            "image_verification_status": "not_submitted",
            "image_verification_reason": "Seeded simulation request",
            "required_skills": skills,
            "created_at": now - timedelta(hours=rng.randint(0, 72), minutes=rng.randint(0, 59)),
        })
        req_ids.append(rid)

    for idx in range(10):
        inc_type, title, desc = rng.choice(NGO_TEMPLATES)
        lat, lng = generate_nearby_location(max_km=18)
        people = rng.randint(5, 100)
        skills = rng.sample(SKILL_POOL, k=rng.randint(1, 3))
        pscore = rng.randint(20, 80)
        plevel = "HIGH" if pscore >= 75 else "MEDIUM" if pscore >= 50 else "LOW"
        rid = _next_id("requests")
        _db().collection("requests").document().set({
            "id": rid, "requester_id": ngo_id,
            "incident_type": inc_type, "title": f"{title} (N-{idx+1})", "description": desc,
            "mode": "NGO", "lat": lat, "lng": lng, "people_count": people,
            "status": "pending", "priority_score": pscore, "priority_level": plevel,
            "cluster_boost": 0, "severity_support_points": 0,
            "ai_insight": None, "image_url": None,
            "image_verification_status": "not_required",
            "image_verification_reason": "NGO mode - image not required",
            "required_skills": skills,
            "created_at": now - timedelta(hours=rng.randint(0, 120), minutes=rng.randint(0, 59)),
        })
        req_ids.append(rid)

    # 15 Assignments
    avail_vols = vol_ids[:35]
    assigned_pairs: set = set()
    count = 0
    for _ in range(80):
        if count >= 15:
            break
        rid = rng.choice(req_ids[:15])
        vid = rng.choice(avail_vols[:30])
        if (rid, vid) in assigned_pairs:
            continue
        assigned_pairs.add((rid, vid))
        score = round(rng.uniform(0.4, 0.95), 3)
        aid = _next_id("assignments")
        _db().collection("assignments").document().set({
            "id": aid, "request_id": rid, "volunteer_id": vid,
            "score": score, "status": "accepted",
            "reason": f"Seeded assignment; score={score}",
            "created_at": datetime.utcnow(),
        })
        # update request status to assigned
        _db().collection("requests").where("id", "==", rid).limit(1).stream()
        update_request(rid, {"status": "assigned"})
        count += 1

    print(f"[SEVAK] Seeded: 3 staff + 50 volunteers + 20 requests + {count} assignments.")
