from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field


# ── Skill ──
class SkillRead(BaseModel):
    id: int
    name: str
    model_config = {"from_attributes": True}


# ── User / Volunteer ──
class UserBase(BaseModel):
    name: str
    role: str
    lat: float = 0
    lng: float = 0
    availability: bool = True
    status: str = "available"
    phone: Optional[str] = None
    rating: float = 0.0
    workload: int = 0


class UserCreate(UserBase):
    skills: List[str] = Field(default_factory=list)


class UserRead(UserBase):
    id: int
    skills: List[SkillRead] = []
    model_config = {"from_attributes": True}


# ── Auth ──
class LoginPayload(BaseModel):
    name: str
    role: str
    phone: Optional[str] = None
    lat: float = 0
    lng: float = 0
    skills: List[str] = Field(default_factory=list)


class RegisterPayload(BaseModel):
    name: str
    role: str
    phone: Optional[str] = None
    lat: float = 0
    lng: float = 0
    skills: List[str] = Field(default_factory=list)


class AuthResponse(BaseModel):
    user: UserRead
    token: str


# ── Request / Task ──
class RequestCreate(BaseModel):
    requester_id: Optional[int] = None
    incident_type: str
    title: str
    description: str
    required_skills: List[str] = Field(default_factory=list)
    people_count: int = 0
    lat: float
    lng: float
    mode: str = "DISASTER"
    image_data: Optional[str] = None


class TaskBulkCreate(BaseModel):
    tasks: List[RequestCreate]


class RequestRead(BaseModel):
    id: int
    requester_id: Optional[int] = None
    incident_type: str
    title: str
    description: str
    mode: str = "DISASTER"
    lat: float
    lng: float
    people_count: int
    status: str
    priority_score: int
    priority_level: str
    cluster_boost: int
    severity_support_points: int = 0
    supporter_count: int = 0
    image_url: Optional[str] = None
    image_verification_status: str = "not_submitted"
    image_verification_reason: Optional[str] = None
    created_at: datetime
    skills: List[SkillRead] = []
    model_config = {"from_attributes": True}


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    priority_level: Optional[str] = None
    mode: Optional[str] = None


# ── Assignment ──
class AssignmentRead(BaseModel):
    id: int
    request_id: int
    volunteer_id: int
    score: float
    status: str
    reason: str
    created_at: datetime
    volunteer: Optional[UserRead] = None
    model_config = {"from_attributes": True}


class RequestDetail(RequestRead):
    assignments: List[AssignmentRead] = []


class NearbyRequestRead(RequestDetail):
    distance_km: float
    supported_by_me: bool = False


class RequestSupportCreate(BaseModel):
    requester_id: int
    points: int = 10


class RequestClaimCreate(BaseModel):
    volunteer_id: int


class RequestResolvePayload(BaseModel):
    requester_id: int


class AssignmentCreate(BaseModel):
    task_id: int
    volunteer_id: int


class AssignmentStatusUpdate(BaseModel):
    status: str


class VolunteerStatusUpdate(BaseModel):
    status: str
    availability: Optional[bool] = None


class VolunteerLocationUpdate(BaseModel):
    lat: float
    lng: float


class VolunteerSkillsUpdate(BaseModel):
    skills: List[str]


class VolunteerUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    availability: Optional[bool] = None
    status: Optional[str] = None


# ── Rating ──
class RatingCreate(BaseModel):
    rating: int = Field(ge=1, le=5)
    comment: Optional[str] = None


class RatingRead(BaseModel):
    id: int
    assignment_id: int
    rating: int
    comment: Optional[str] = None
    created_at: datetime
    model_config = {"from_attributes": True}


# ── Matching ──
class MatchResult(BaseModel):
    volunteer: UserRead
    score: float
    justification: str


class MatchResponse(BaseModel):
    task_id: int
    mode: str
    top_volunteers: List[MatchResult]
    auto_assigned: bool = False


# ── Admin ──
class AdminOverview(BaseModel):
    totals: dict
    requests: List[RequestDetail]
    volunteers: List[UserRead]


# ── Analytics ──
class DashboardAnalytics(BaseModel):
    total_tasks: int
    active_tasks: int
    completed_tasks: int
    total_volunteers: int
    available_volunteers: int
    disaster_tasks: int
    ngo_tasks: int
    critical_tasks: int
    avg_response_time_min: float
    completion_rate: float
    tasks_by_status: dict
    tasks_by_priority: dict
    tasks_by_mode: dict
    recent_activity: List[dict]


class HeatmapPoint(BaseModel):
    lat: float
    lng: float
    intensity: float
    label: str


class VolunteerPerformance(BaseModel):
    volunteer_id: int
    name: str
    tasks_completed: int
    avg_rating: float
    availability_rate: float
    skills: List[str]


class SkillDemandItem(BaseModel):
    skill: str
    demand: int
    supply: int
    gap: int


# ── Image verification ──
class ImageVerificationSummary(BaseModel):
    is_disaster: Optional[bool] = None
    confidence: Optional[float] = None
    labels: List[str] = Field(default_factory=list)
    reason: str = ""
    warnings: List[str] = Field(default_factory=list)


class RequestCreateResponse(BaseModel):
    request: RequestDetail
    assigned_count: int
    suggested_volunteers: List[AssignmentRead]
    duplicate_detected: bool = False
    duplicate_points_added: int = 0
    duplicate_request: Optional[RequestDetail] = None
    verification: Optional[ImageVerificationSummary] = None
    match_results: Optional[MatchResponse] = None
