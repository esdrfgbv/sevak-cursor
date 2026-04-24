from sqlalchemy import and_, func, select
from sqlalchemy.orm import Session

from ..models import Request
from ..utils.geo import haversine_km  # re-exported for legacy imports


def cluster_metrics_for_request(db: Session, lat: float, lng: float, radius_km: float = 0.5) -> tuple[int, int]:
    """
    Returns (cluster_boost_points, nearby_active_request_count within radius).
    """
    nearby = db.scalars(
        select(Request).where(
            and_(
                Request.status != "completed",
                func.abs(Request.lat - lat) <= 0.01,
                func.abs(Request.lng - lng) <= 0.01,
            )
        )
    ).all()
    count = sum(1 for request in nearby if haversine_km(lat, lng, request.lat, request.lng) <= radius_km)
    boost = min((count + 1) * 6, 20) if count >= 1 else 0
    return boost, count


def cluster_boost_for_request(db: Session, lat: float, lng: float, radius_km: float = 0.5) -> int:
    boost, _ = cluster_metrics_for_request(db, lat, lng, radius_km=radius_km)
    return boost
