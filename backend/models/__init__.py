"""
Models as plain Python dataclasses.
Replaces SQLAlchemy ORM — same attribute interface so services work unchanged.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional

from .services.priority_engine import explain_priority


@dataclass
class Skill:
    id: int
    name: str

    def __hash__(self):
        return hash(self.id)


@dataclass
class User:
    id: int
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
    id: int
    request_id: int
    volunteer_id: int
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
    id: int
    request_id: int
    requester_id: int
    points: int = 10
    created_at: datetime = field(default_factory=datetime.utcnow)


@dataclass
class Request:
    id: int
    incident_type: str
    title: str
    description: str
    lat: float
    lng: float
    requester_id: Optional[int] = None
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
    id: int
    assignment_id: int
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
