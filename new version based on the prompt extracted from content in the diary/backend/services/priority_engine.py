from collections.abc import Iterable


CRITICAL_KEYWORDS = {
    "trapped": 25,
    "collapse": 24,
    "fire": 22,
    "flood": 20,
    "medical": 18,
    "injured": 18,
    "urgent": 16,
    "evacuation": 16,
    "landslide": 20,
    "earthquake": 18,
    "unconscious": 22,
}

SKILL_CRITICALITY = {
    "medical": 18,
    "paramedic": 18,
    "swift water rescue": 17,
    "search and rescue": 16,
    "firefighting": 15,
    "structural rescue": 15,
    "logistics": 8,
    "electrical": 10,
}


def _normalize(values: Iterable[str]) -> list[str]:
    return [value.strip().lower() for value in values if value and value.strip()]


def calculate_priority(description: str, people_count: int, required_skills: list[str], cluster_boost: int = 0) -> tuple[int, str]:
    text = description.lower()
    keyword_points = sum(weight for keyword, weight in CRITICAL_KEYWORDS.items() if keyword in text)
    people_points = min(people_count * 3, 30)
    skill_points = sum(SKILL_CRITICALITY.get(skill, 6) for skill in _normalize(required_skills))
    total = min(keyword_points + people_points + skill_points + cluster_boost, 100)

    if total >= 88:
        return total, "CRITICAL"
    if total >= 75:
        return total, "HIGH"
    if total >= 50:
        return total, "MEDIUM"
    return total, "LOW"


def allocation_count(priority_level: str, people_count: int, cluster_size: int) -> int:
    """
    Dynamic responder counts:
      Low -> 1
      Medium -> 2-3
      High -> 4-6
      Critical -> 6+
    """
    level = (priority_level or "LOW").upper()
    people = max(int(people_count or 0), 0)
    cluster = max(int(cluster_size or 0), 0)

    if level == "LOW":
        return 1

    if level == "MEDIUM":
        base = 2 + min(people // 18, 1) + min(cluster // 3, 1)
        return max(2, min(3, base))

    if level == "HIGH":
        base = 4 + min(people // 25, 2) + min(cluster // 2, 1)
        return max(4, min(6, base))

    if level == "CRITICAL":
        base = 6 + min(people // 20, 4) + min(cluster, 3)
        return max(6, min(12, base))

    # Fallback for unexpected labels
    return 1


def target_volunteer_count(priority_level: str) -> int:
    """Backward compatible default without cluster/people context."""
    return {"CRITICAL": 8, "HIGH": 5, "MEDIUM": 2, "LOW": 1}.get(priority_level.upper(), 1)
