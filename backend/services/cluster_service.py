from firebase_service import get_requests
from models import request_from_dict

from models import Request
from utils.geo import haversine_km  # re-exported for legacy imports


def cluster_metrics_for_request(lat: float, lng: float, radius_km: float = 0.5) -> tuple[int, int]:
    """
    Returns (cluster_boost_points, nearby_active_request_count within radius).
    """
    request_dicts = get_requests(status="pending") + get_requests(status="assigned")
    nearby = []
    for req_dict in request_dicts:
        req = request_from_dict(req_dict)
        if req.status != "completed" and abs(req.lat - lat) <= 0.01 and abs(req.lng - lng) <= 0.01:
            nearby.append(req)
            
    count = sum(1 for request in nearby if haversine_km(lat, lng, request.lat, request.lng) <= radius_km)
    boost = min((count + 1) * 6, 20) if count >= 1 else 0
    return boost, count


def cluster_boost_for_request(lat: float, lng: float, radius_km: float = 0.5) -> int:
    boost, _ = cluster_metrics_for_request(lat, lng, radius_km=radius_km)
    return boost
