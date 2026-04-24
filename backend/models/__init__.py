from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, String, Table, Text, UniqueConstraint, text
from sqlalchemy.orm import relationship

from ..database import Base

volunteer_skills = Table(
    "volunteer_skills",
    Base.metadata,
    Column("user_id", ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
    Column("skill_id", ForeignKey("skills.id", ondelete="CASCADE"), primary_key=True),
)

request_skills = Table(
    "request_skills",
    Base.metadata,
    Column("request_id", ForeignKey("requests.id", ondelete="CASCADE"), primary_key=True),
    Column("skill_id", ForeignKey("skills.id", ondelete="CASCADE"), primary_key=True),
)


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(120), nullable=False)
    role = Column(String(20), nullable=False, index=True)
    lat = Column(Float, default=0, server_default=text("0"))
    lng = Column(Float, default=0, server_default=text("0"))
    availability = Column(Boolean, default=True, server_default=text("1"))
    status = Column(String(30), default="available", server_default=text("'available'"), nullable=False)
    phone = Column(String(30), nullable=True)
    rating = Column(Float, default=0.0, server_default=text("0"), nullable=False)
    workload = Column(Integer, default=0, server_default=text("0"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, server_default=text("CURRENT_TIMESTAMP"), nullable=False)

    skills = relationship("Skill", secondary=volunteer_skills, back_populates="volunteers")
    requests = relationship("Request", back_populates="requester")
    volunteer_assignments = relationship("Assignment", back_populates="volunteer")
    support_votes = relationship("SupportVote", back_populates="requester", cascade="all, delete-orphan")


class Skill(Base):
    __tablename__ = "skills"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(80), unique=True, nullable=False)

    volunteers = relationship("User", secondary=volunteer_skills, back_populates="skills")
    requests = relationship("Request", secondary=request_skills, back_populates="skills")


class Request(Base):
    __tablename__ = "requests"

    id = Column(Integer, primary_key=True, index=True)
    requester_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    incident_type = Column(String(80), nullable=False)
    title = Column(String(160), nullable=False)
    description = Column(Text, nullable=False)
    mode = Column(String(20), default="DISASTER", server_default=text("'DISASTER'"), nullable=False)
    lat = Column(Float, nullable=False)
    lng = Column(Float, nullable=False)
    people_count = Column(Integer, default=0, server_default=text("0"), nullable=False)
    status = Column(String(20), default="pending", server_default=text("'pending'"), nullable=False)
    priority_score = Column(Integer, default=0, server_default=text("0"), nullable=False)
    priority_level = Column(String(20), default="LOW", server_default=text("'LOW'"), nullable=False)
    cluster_boost = Column(Integer, default=0, server_default=text("0"), nullable=False)
    severity_support_points = Column(Integer, default=0, server_default=text("0"), nullable=False)
    image_url = Column(Text, nullable=True)
    image_verification_status = Column(
        String(40), default="not_submitted", server_default=text("'not_submitted'"), nullable=False
    )
    image_verification_reason = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, server_default=text("CURRENT_TIMESTAMP"), nullable=False)

    requester = relationship("User", back_populates="requests")
    skills = relationship("Skill", secondary=request_skills, back_populates="requests")
    assignments = relationship("Assignment", back_populates="request", cascade="all, delete-orphan")
    support_votes = relationship("SupportVote", back_populates="request", cascade="all, delete-orphan")

    @property
    def supporter_count(self) -> int:
        return len(self.support_votes or [])


class Assignment(Base):
    __tablename__ = "assignments"

    id = Column(Integer, primary_key=True, index=True)
    request_id = Column(Integer, ForeignKey("requests.id", ondelete="CASCADE"), nullable=False, index=True)
    volunteer_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    score = Column(Float, nullable=False)
    status = Column(String(30), default="accepted", server_default=text("'accepted'"), nullable=False)
    reason = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, server_default=text("CURRENT_TIMESTAMP"), nullable=False)

    request = relationship("Request", back_populates="assignments")
    volunteer = relationship("User", back_populates="volunteer_assignments")
    ratings = relationship("Rating", back_populates="assignment", cascade="all, delete-orphan")


class Rating(Base):
    __tablename__ = "ratings"

    id = Column(Integer, primary_key=True, index=True)
    assignment_id = Column(Integer, ForeignKey("assignments.id", ondelete="CASCADE"), nullable=False, index=True)
    rating = Column(Integer, nullable=False)
    comment = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, server_default=text("CURRENT_TIMESTAMP"), nullable=False)

    assignment = relationship("Assignment", back_populates="ratings")


class SupportVote(Base):
    __tablename__ = "support_votes"
    __table_args__ = (UniqueConstraint("request_id", "requester_id", name="uq_support_vote_request_requester"),)

    id = Column(Integer, primary_key=True, index=True)
    request_id = Column(Integer, ForeignKey("requests.id", ondelete="CASCADE"), nullable=False, index=True)
    requester_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    points = Column(Integer, default=10, server_default=text("10"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, server_default=text("CURRENT_TIMESTAMP"), nullable=False)

    request = relationship("Request", back_populates="support_votes")
    requester = relationship("User", back_populates="support_votes")
