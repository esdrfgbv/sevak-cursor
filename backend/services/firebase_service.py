"""
Firebase Firestore service layer for SEVAK.
Replaces all SQLAlchemy database operations.
"""
from __future__ import annotations

import math
import random
from datetime import datetime
from typing import Any

import firebase_admin
from firebase_admin import credentials, firestore

from .. import config

# Initialize Firebase (once per app)
if not firebase_admin._apps:
    if config.FIREBASE_CREDENTIALS_PATH:
        cred = credentials.Certificate(config.FIREBASE_CREDENTIALS_PATH)
        firebase_admin.initialize_app(cred)
    else:
        raise RuntimeError("FIREBASE_CREDENTIALS_PATH not configured")

db = firestore.client()


# ── Location Helpers ─────────────────────────────────────────────────────────

def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Calculate distance between two coordinates in km."""
    R = 6371.0  # Earth radius in km
    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    
    a = math.sin(dlat / 2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(dlng / 2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    
    return R * c


def generate_nearby_location() -> tuple[float, float]:
    """Generate coordinates within DEMO_RADIUS_KM of base location."""
    # Convert km to degrees (approximate)
    max_offset_degrees = config.DEMO_RADIUS_KM / 111.0
    
    lat_offset = random.uniform(-max_offset_degrees, max_offset_degrees)
    lng_offset = random.uniform(-max_offset_degrees, max_offset_degrees)
    
    lat = round(config.BASE_LAT + lat_offset, 5)
    lng = round(config.BASE_LNG + lng_offset, 5)
    
    return lat, lng


def is_within_demo_radius(lat: float, lng: float) -> bool:
    """Check if location is within demo radius of base location."""
    distance = haversine_km(config.BASE_LAT, config.BASE_LNG, lat, lng)
    return distance <= config.DEMO_RADIUS_KM


# ── Firestore Conversion Helpers ─────────────────────────────────────────────

def _parse_timestamp(ts: Any) -> datetime:
    """Parse Firestore timestamp to datetime."""
    if isinstance(ts, datetime):
        return ts
    if hasattr(ts, 'seconds'):
        return datetime.utcfromtimestamp(ts.seconds)
    return datetime.utcnow()


# ── Skill Operations ─────────────────────────────────────────────────────────

def get_all_skills() -> list[dict]:
    """Get all skills from Firestore."""
    docs = db.collection('skills').stream()
    return [{'id': doc.id, 'name': doc.to_dict()['name']} for doc in docs]


def get_or_create_skill(skill_name: str) -> dict:
    """Get skill by name or create it."""
    docs = db.collection('skills').where('name', '==', skill_name).limit(1).stream()
    for doc in docs:
        return {'id': doc.id, 'name': doc.to_dict()['name']}
    
    # Create new skill
    doc_ref = db.collection('skills').document()
    doc_ref.set({
        'name': skill_name,
        'created_at': datetime.utcnow()
    })
    return {'id': doc_ref.id, 'name': skill_name}


# ── User Operations ──────────────────────────────────────────────────────────

def get_all_users(role: str | None = None) -> list[dict]:
    """Get all users, optionally filtered by role."""
    query = db.collection('users')
    if role:
        query = query.where('role', '==', role)
    
    docs = query.stream()
    return [_doc_to_user(doc) for doc in docs]


def get_user(user_id: str) -> dict | None:
    """Get a single user by ID."""
    doc = db.collection('users').document(user_id).get()
    if doc.exists:
        return _doc_to_user(doc)
    return None


def create_user(user_data: dict) -> dict:
    """Create a new user in Firestore."""
    doc_ref = db.collection('users').document()
    user_data['id'] = doc_ref.id
    user_data['created_at'] = datetime.utcnow()
    doc_ref.set(user_data)
    return _doc_to_user(doc_ref.get())


def update_user(user_id: str, updates: dict) -> dict | None:
    """Update user data."""
    db.collection('users').document(user_id).update(updates)
    return get_user(user_id)


def delete_user(user_id: str) -> None:
    """Delete a user."""
    db.collection('users').document(user_id).delete()


def _doc_to_user(doc) -> dict:
    """Convert Firestore document to user dict."""
    data = doc.to_dict()
    return {
        'id': doc.id,
        'name': data.get('name', ''),
        'role': data.get('role', 'volunteer'),
        'lat': data.get('lat', 0.0),
        'lng': data.get('lng', 0.0),
        'availability': data.get('availability', True),
        'status': data.get('status', 'available'),
        'phone': data.get('phone'),
        'rating': data.get('rating', 0.0),
        'workload': data.get('workload', 0),
        'skills': data.get('skills', []),
        'created_at': _parse_timestamp(data.get('created_at'))
    }


# ── Request Operations ───────────────────────────────────────────────────────

def get_all_requests(status: str | None = None) -> list[dict]:
    """Get all requests, optionally filtered by status."""
    query = db.collection('requests')
    if status:
        query = query.where('status', '==', status)
    
    docs = query.order_by('created_at', direction=firestore.Query.DESCENDING).stream()
    return [_doc_to_request(doc) for doc in docs]


def get_request(request_id: str) -> dict | None:
    """Get a single request by ID."""
    doc = db.collection('requests').document(request_id).get()
    if doc.exists:
        return _doc_to_request(doc)
    return None


def create_request(request_data: dict) -> dict:
    """Create a new request in Firestore."""
    doc_ref = db.collection('requests').document()
    request_data['id'] = doc_ref.id
    request_data['created_at'] = datetime.utcnow()
    doc_ref.set(request_data)
    return _doc_to_request(doc_ref.get())


def update_request(request_id: str, updates: dict) -> dict | None:
    """Update request data."""
    db.collection('requests').document(request_id).update(updates)
    return get_request(request_id)


def delete_request(request_id: str) -> None:
    """Delete a request."""
    db.collection('requests').document(request_id).delete()


def _doc_to_request(doc) -> dict:
    """Convert Firestore document to request dict."""
    data = doc.to_dict()
    return {
        'id': doc.id,
        'requester_id': data.get('requester_id'),
        'incident_type': data.get('incident_type', ''),
        'title': data.get('title', ''),
        'description': data.get('description', ''),
        'mode': data.get('mode', 'DISASTER'),
        'lat': data.get('lat', 0.0),
        'lng': data.get('lng', 0.0),
        'people_count': data.get('people_count', 0),
        'status': data.get('status', 'pending'),
        'priority_score': data.get('priority_score', 0),
        'priority_level': data.get('priority_level', 'LOW'),
        'cluster_boost': data.get('cluster_boost', 0),
        'severity_support_points': data.get('severity_support_points', 0),
        'image_url': data.get('image_url'),
        'image_verification_status': data.get('image_verification_status', 'not_submitted'),
        'image_verification_reason': data.get('image_verification_reason'),
        'ai_insight': data.get('ai_insight'),
        'required_skills': data.get('required_skills', []),
        'created_at': _parse_timestamp(data.get('created_at'))
    }


# ── Assignment Operations ────────────────────────────────────────────────────

def get_assignments_for_request(request_id: str) -> list[dict]:
    """Get all assignments for a request."""
    docs = db.collection('assignments').where('request_id', '==', request_id).stream()
    return [_doc_to_assignment(doc) for doc in docs]


def get_assignments_for_volunteer(volunteer_id: str) -> list[dict]:
    """Get all assignments for a volunteer."""
    docs = db.collection('assignments').where('volunteer_id', '==', volunteer_id).stream()
    return [_doc_to_assignment(doc) for doc in docs]


def create_assignment(assignment_data: dict) -> dict:
    """Create a new assignment in Firestore."""
    doc_ref = db.collection('assignments').document()
    assignment_data['id'] = doc_ref.id
    assignment_data['created_at'] = datetime.utcnow()
    doc_ref.set(assignment_data)
    return _doc_to_assignment(doc_ref.get())


def update_assignment(assignment_id: str, updates: dict) -> dict | None:
    """Update assignment data."""
    db.collection('assignments').document(assignment_id).update(updates)
    return get_assignment(assignment_id)


def get_assignment(assignment_id: str) -> dict | None:
    """Get a single assignment by ID."""
    doc = db.collection('assignments').document(assignment_id).get()
    if doc.exists:
        return _doc_to_assignment(doc)
    return None


def _doc_to_assignment(doc) -> dict:
    """Convert Firestore document to assignment dict."""
    data = doc.to_dict()
    return {
        'id': doc.id,
        'request_id': data.get('request_id', ''),
        'volunteer_id': data.get('volunteer_id', ''),
        'score': data.get('score', 0.0),
        'status': data.get('status', 'accepted'),
        'reason': data.get('reason', ''),
        'created_at': _parse_timestamp(data.get('created_at'))
    }


# ── Rating Operations ────────────────────────────────────────────────────────

def create_rating(rating_data: dict) -> dict:
    """Create a new rating."""
    doc_ref = db.collection('ratings').document()
    rating_data['id'] = doc_ref.id
    rating_data['created_at'] = datetime.utcnow()
    doc_ref.set(rating_data)
    return _doc_to_rating(doc_ref.get())


def get_ratings_for_assignment(assignment_id: str) -> list[dict]:
    """Get all ratings for an assignment."""
    docs = db.collection('ratings').where('assignment_id', '==', assignment_id).stream()
    return [_doc_to_rating(doc) for doc in docs]


def _doc_to_rating(doc) -> dict:
    """Convert Firestore document to rating dict."""
    data = doc.to_dict()
    return {
        'id': doc.id,
        'assignment_id': data.get('assignment_id', ''),
        'rating': data.get('rating', 0),
        'comment': data.get('comment'),
        'created_at': _parse_timestamp(data.get('created_at'))
    }


# ── Support Vote Operations ──────────────────────────────────────────────────

def create_support_vote(vote_data: dict) -> dict:
    """Create a support vote for a request."""
    doc_ref = db.collection('support_votes').document()
    vote_data['id'] = doc_ref.id
    vote_data['created_at'] = datetime.utcnow()
    doc_ref.set(vote_data)
    return vote_data


def get_support_votes_for_request(request_id: str) -> list[dict]:
    """Get all support votes for a request."""
    docs = db.collection('support_votes').where('request_id', '==', request_id).stream()
    return [doc.to_dict() for doc in docs]
