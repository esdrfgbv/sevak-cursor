from datetime import datetime
from typing import List, Optional, Dict, Any

from fastapi import FastAPI
from pydantic import BaseModel, Field

app = FastAPI(title="Matching Engine", version="1.0.0")


class VolunteerCandidate(BaseModel):
  volunteer_id: str
  # Skill factor is precomputed in backend (0-100). We keep this engine deterministic for prototype.
  skill_match: float = Field(ge=0, le=100)
  distance_km: float = Field(ge=0)
  availability: float = Field(ge=0, le=100)
  reliability: float = Field(ge=0, le=100)


class MatchRequest(BaseModel):
  task_id: str
  max_distance_km: float = 50.0
  limit: int = 3
  candidates: List[VolunteerCandidate]


class MatchResult(BaseModel):
  volunteer_id: str
  score: float
  factors: Dict[str, Any]
  justification: str


def _proximity_score(distance_km: float, max_distance_km: float) -> float:
  if max_distance_km <= 0:
    return 0.0
  score = 100.0 - (distance_km / max_distance_km) * 100.0
  return max(0.0, min(100.0, score))


@app.get("/health")
def health():
  return {"ok": True, "ts": datetime.utcnow().isoformat() + "Z"}


@app.post("/match", response_model=List[MatchResult])
def match(req: MatchRequest):
  results: List[MatchResult] = []
  for c in req.candidates:
    proximity = _proximity_score(c.distance_km, req.max_distance_km)
    # weights from spec: 40/25/20/15; capacity is handled by backend as filter
    score = (0.40 * c.skill_match) + (0.25 * proximity) + (0.20 * c.availability) + (0.15 * c.reliability)

    justification = (
      f"Skill {c.skill_match:.0f}%, proximity {proximity:.0f}%, "
      f"availability {c.availability:.0f}%, reliability {c.reliability:.0f}%."
    )
    results.append(
      MatchResult(
        volunteer_id=c.volunteer_id,
        score=round(score, 2),
        factors={
          "skill_match": c.skill_match,
          "proximity": proximity,
          "availability": c.availability,
          "reliability": c.reliability,
          "distance_km": c.distance_km,
        },
        justification=justification,
      )
    )

  results.sort(key=lambda r: r.score, reverse=True)
  return results[: max(1, req.limit)]

