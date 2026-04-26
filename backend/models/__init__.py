"""
Models as plain Python dataclasses.
Replaces SQLAlchemy ORM — same attribute interface so services work unchanged.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional, Union

from services.priority_engine import explain_priority


@dataclass
class Skill:
    id: Union[int, str]
    name: str

    def __hash__(self):
        return hash(self.id)


@dataclass
class User:
    id: Union[int, str]
    name: str
    role: str
    lat: float = 0.0
    lng: float = 0.0
    availability: bool = True
    status: str = "available"
    phone: Optional[str] = None
    rating: float = 0.0
    workload: int = 0
    skills: list = field(default_factory=list)        # List[Skill]
    created_at: datetime = field(default_factory=datetime.utcnow)
    volunteer_assignments: list = field(default_factory=list)
    requests: list = field(default_factory=list)
    support_votes: list = field(default_factory=list)


@dataclass
class Assignment:
    id: Union[int, str]
    request_id: Union[int, str]
    volunteer_id: Union[int, str]
    score: float
    status: str = "accepted"
    reason: str = ""
    created_at: datetime = field(default_factory=datetime.utcnow)
    volunteer: Optional[User] = None
    request: Optional["Request"] = None
    ratings: list = field(default_factory=list)

    @property
    def match_label(self) -> str:
        if self.score >= 0.85:
            return "High Match"
        if self.score >= 0.7:
            return "Strong Fit"
        if self.score >= 0.5:
            return "Good Fit"
        return "Backup Fit"


@dataclass
class SupportVote:
    id: Union[int, str]
    request_id: Union[int, str]
    requester_id: Union[int, str]
    points: int = 10
    created_at: datetime = field(default_factory=datetime.utcnow)


@dataclass
class Request:
    id: Union[int, str]
    incident_type: str
    title: str
    description: str
    lat: float
    lng: float
    requester_id: Optional[Union[int, str]] = None
    mode: str = "DISASTER"
    people_count: int = 0
    status: str = "pending"
    priority_score: int = 0
    priority_level: str = "LOW"
    cluster_boost: int = 0
    severity_support_points: int = 0
    image_url: Optional[str] = None
    image_verification_status: str = "not_submitted"
    image_verification_reason: Optional[str] = None
    ai_insight: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.utcnow)
    skills: list = field(default_factory=list)          # List[Skill]
    assignments: list = field(default_factory=list)      # List[Assignment]
    support_votes: list = field(default_factory=list)    # List[SupportVote]
    requester: Optional[User] = None

    @property
    def supporter_count(self) -> int:
        return len(self.support_votes or [])

    @property
    def priority_explanation(self) -> str:
        return explain_priority(
            self.description,
            self.people_count,
            [s.name for s in (self.skills or [])],
            self.cluster_boost + self.severity_support_points,
        )


@dataclass
class Rating:
    id: Union[int, str]
    assignment_id: Union[int, str]
    rating: int
    comment: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.utcnow)
    assignment: Optional[Assignment] = None


# ── Conversion helpers ────────────────────────────────────────────────────────

def skill_from_dict(d: dict) -> Skill:
    return Skill(id=d.get("id", 0), name=d.get("name", ""))


def user_from_dict(d: dict) -> User:
    skills = [Skill(id=0, name=s) if isinstance(s, str) else skill_from_dict(s)
              for s in (d.get("skills") or [])]
    return User(
        id=d.get("id", 0),
        name=d.get("name", ""),
        role=d.get("role", "volunteer"),
        lat=float(d.get("lat", 0)),
        lng=float(d.get("lng", 0)),
        availability=bool(d.get("availability", True)),
        status=d.get("status", "available"),
        phone=d.get("phone"),
        rating=float(d.get("rating", 0.0)),
        workload=int(d.get("workload", 0)),
        skills=skills,
        created_at=d.get("created_at", datetime.utcnow()),
    )


def assignment_from_dict(d: dict) -> Assignment:
    vol = user_from_dict(d["volunteer"]) if d.get("volunteer") else None
    return Assignment(
        id=d.get("id", 0),
        request_id=d.get("request_id", 0),
        volunteer_id=d.get("volunteer_id", 0),
        score=float(d.get("score", 0.0)),
        status=d.get("status", "accepted"),
        reason=d.get("reason", ""),
        created_at=d.get("created_at", datetime.utcnow()),
        volunteer=vol,
    )


def request_from_dict(d: dict) -> Request:
    skills = [Skill(id=0, name=s) if isinstance(s, str) else skill_from_dict(s)
              for s in (d.get("required_skills") or d.get("skills") or [])]
    assignments = [assignment_from_dict(a) for a in (d.get("assignments") or [])]
    support_votes = [
        SupportVote(
            id=v.get("id", 0),
            request_id=v.get("request_id", d.get("id", 0)),
            requester_id=v.get("requester_id", 0),
            points=v.get("points", 10),
        )
        for v in (d.get("support_votes") or [])
    ]
    return Request(
        id=d.get("id", 0),
        requester_id=d.get("requester_id"),
        incident_type=d.get("incident_type", ""),
        title=d.get("title", ""),
        description=d.get("description", ""),
        mode=d.get("mode", "DISASTER"),
        lat=float(d.get("lat", 0)),
        lng=float(d.get("lng", 0)),
        people_count=int(d.get("people_count", 0)),
        status=d.get("status", "pending"),
        priority_score=int(d.get("priority_score", 0)),
        priority_level=d.get("priority_level", "LOW"),
        cluster_boost=int(d.get("cluster_boost", 0)),
        severity_support_points=int(d.get("severity_support_points", 0)),
        image_url=d.get("image_url"),
        image_verification_status=d.get("image_verification_status", "not_submitted"),
        image_verification_reason=d.get("image_verification_reason"),
        ai_insight=d.get("ai_insight"),
        created_at=d.get("created_at", datetime.utcnow()),
        skills=skills,
        assignments=assignments,
        support_votes=support_votes,
    )


def rating_from_dict(d: dict) -> Rating:
    return Rating(
        id=d.get("id", 0),
        assignment_id=d.get("assignment_id", 0),
        rating=int(d.get("rating", 0)),
        comment=d.get("comment"),
        created_at=d.get("created_at", datetime.utcnow()),
    )


# ── Firestore Conversion Helpers ─────────────────────────────────────────────

def user_to_firestore(user: User) -> dict:
    """Convert User model to Firestore dict."""
    return {
        'name': user.name,
        'role': user.role,
        'lat': user.lat,
        'lng': user.lng,
        'availability': user.availability,
        'status': user.status,
        'phone': user.phone,
        'rating': user.rating,
        'workload': user.workload,
        'skills': [s.name if isinstance(s, Skill) else s for s in user.skills],
        'created_at': user.created_at.isoformat() if user.created_at else None
    }


def user_from_firestore(user_dict: dict) -> User:
    """Convert Firestore dict to User model."""
    skills = [Skill(id=0, name=s) if isinstance(s, str) else skill_from_dict(s)
              for s in (user_dict.get("skills") or [])]
    return User(
        id=user_dict.get("id", 0),
        name=user_dict.get("name", ""),
        role=user_dict.get("role", "volunteer"),
        lat=float(user_dict.get("lat", 0)),
        lng=float(user_dict.get("lng", 0)),
        availability=bool(user_dict.get("availability", True)),
        status=user_dict.get("status", "available"),
        phone=user_dict.get("phone"),
        rating=float(user_dict.get("rating", 0.0)),
        workload=int(user_dict.get("workload", 0)),
        skills=skills,
        created_at=user_dict.get("created_at", datetime.utcnow()),
    )


def request_to_firestore(request: Request) -> dict:
    """Convert Request model to Firestore dict."""
    return {
        'requester_id': request.requester_id,
        'incident_type': request.incident_type,
        'title': request.title,
        'description': request.description,
        'mode': request.mode,
        'lat': request.lat,
        'lng': request.lng,
        'people_count': request.people_count,
        'status': request.status,
        'priority_score': request.priority_score,
        'priority_level': request.priority_level,
        'cluster_boost': request.cluster_boost,
        'severity_support_points': request.severity_support_points,
        'image_url': request.image_url,
        'image_verification_status': request.image_verification_status,
        'image_verification_reason': request.image_verification_reason,
        'ai_insight': request.ai_insight,
        'required_skills': [s.name if isinstance(s, Skill) else s for s in request.skills],
        'created_at': request.created_at.isoformat() if request.created_at else None
    }


def request_from_firestore(request_dict: dict) -> Request:
    """Convert Firestore dict to Request model."""
    skills = [Skill(id=0, name=s) if isinstance(s, str) else skill_from_dict(s)
              for s in (request_dict.get("required_skills") or request_dict.get("skills") or [])]
    return Request(
        id=request_dict.get("id", 0),
        requester_id=request_dict.get("requester_id"),
        incident_type=request_dict.get("incident_type", ""),
        title=request_dict.get("title", ""),
        description=request_dict.get("description", ""),
        mode=request_dict.get("mode", "DISASTER"),
        lat=float(request_dict.get("lat", 0)),
        lng=float(request_dict.get("lng", 0)),
        people_count=int(request_dict.get("people_count", 0)),
        status=request_dict.get("status", "pending"),
        priority_score=int(request_dict.get("priority_score", 0)),
        priority_level=request_dict.get("priority_level", "LOW"),
        cluster_boost=int(request_dict.get("cluster_boost", 0)),
        severity_support_points=int(request_dict.get("severity_support_points", 0)),
        image_url=request_dict.get("image_url"),
        image_verification_status=request_dict.get("image_verification_status", "not_submitted"),
        image_verification_reason=request_dict.get("image_verification_reason"),
        ai_insight=request_dict.get("ai_insight"),
        created_at=request_dict.get("created_at", datetime.utcnow()),
        skills=skills,
    )
