"""Auth router with /api/auth/ prefix."""
from fastapi import APIRouter, HTTPException

import schemas
from firebase_service import get_user_by_name, create_user, update_user

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _upsert_user(payload) -> dict:
    """Create or update user in Firebase."""
    # Check if user exists
    user = get_user_by_name(payload.name)
    
    if not user:
        # Create new user
        user_data = {
            'name': payload.name,
            'role': payload.role,
            'phone': getattr(payload, "phone", None),
            'lat': payload.lat,
            'lng': payload.lng,
            'availability': payload.role == "volunteer",
            'status': "available",
            'skills': [],
            'rating': 5.0,
            'workload': 0,
        }
        create_user(user_data)
        user = get_user_by_name(payload.name)
    else:
        # Update existing user
        user_id = user.get('id')
        update_data = {
            'phone': getattr(payload, "phone", None) or user.get('phone'),
            'role': payload.role,
            'lat': payload.lat,
            'lng': payload.lng,
        }
        if payload.role == "volunteer" and user.get('status') in {"available", "completed"}:
            update_data['availability'] = True
        elif payload.role != "volunteer":
            update_data['availability'] = False
        
        update_user(user_id, update_data)
        user = get_user_by_name(payload.name)
    
    # Handle skills for volunteers
    if payload.role == "volunteer" and payload.skills:
        # Standardize skills via the main Firebase service layer (auto-incremented skills collection).
        from firebase_service import ensure_skills

        ensure_skills(list(payload.skills))
        update_user(user.get("id"), {"skills": list(payload.skills)})
        user = get_user_by_name(payload.name)
    
    return user


@router.post("/register", response_model=schemas.AuthResponse)
def register(payload: schemas.RegisterPayload):
    existing = get_user_by_name(payload.name)
    if existing:
        raise HTTPException(status_code=400, detail="User already exists. Please login.")
    user = _upsert_user(payload)
    token = f"sevak-token-{user.get('id')}"
    return {"user": user, "token": token}


@router.post("/login", response_model=schemas.AuthResponse)
def login(payload: schemas.LoginPayload):
    user = _upsert_user(payload)
    token = f"sevak-token-{user.get('id')}"
    return {"user": user, "token": token}
