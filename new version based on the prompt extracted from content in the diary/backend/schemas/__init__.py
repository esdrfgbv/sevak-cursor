from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field


class SkillRead(BaseModel):
    id: int
    name: str

    model_config = {"from_attributes": True}


class UserBase(BaseModel):
    name: str
    role: str
    lat: float = 0
    lng: float = 0
    availability: bool = True
    status: str = "available"
    phone: Optional[str] = None


class UserCreate(UserBase):
    skills: List[str] = Field(default_factory=list)


class UserRead(UserBase):
    id: int
    skills: List[SkillRead] = []

    model_config = {"from_attributes": True}


class LoginPayload(BaseModel):
    name: str
    role: str
    phone: Optional[str] = None
    lat: float = 0
    lng: float = 0
    skills: List[str] = Field(default_factory=list)


class RequestCreate(BaseModel):
    requester_id: Optional[int] = None
    incident_type: str
    title: str
    description: str
    required_skills: List[str] = Field(default_factory=list)
    people_count: int = 0
    lat: float
    lng: float
    image_data: Optional[str] = None


class RequestRead(BaseModel):
    id: int
    requester_id: Optional[int] = None
    incident_type: str
    title: str
    description: str
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


class AssignmentStatusUpdate(BaseModel):
    status: str


class VolunteerStatusUpdate(BaseModel):
    status: str
    availability: Optional[bool] = None


class VolunteerLocationUpdate(BaseModel):
    lat: float
    lng: float


class AdminOverview(BaseModel):
    totals: dict
    requests: List[RequestDetail]
    volunteers: List[UserRead]


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
