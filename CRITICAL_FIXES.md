# SEVAK - CRITICAL ISSUES FOR FIXING

## Priority 1: MUST FIX BEFORE DEMO (30 minutes)

### P1.1: Enable Gemini API Integration
- **Severity:** CRITICAL
- **Status:** DISABLED - Not called at all
- **Files:**
  - `backend/.env` line 3
  - `backend/services/gemini_service.py` line 33-40 (fallback logic)
  
**Current State:**
```python
# backend/.env
# GEMINI_API_KEY=AIzaSyDYfUR6xLc2jaBPUNRxH0r5M3_oYBhIPBA
```

```python
# gemini_service.py:33-40
if not config.GEMINI_API_KEY:
    return {
        "is_disaster": True,
        "confidence": 1.0,
        "labels": [],
        "reason": "GEMINI_API_KEY not configured; vision verification skipped."
    }
```

**Fix Required:**
1. Replace commented Gemini key with valid key (or get from environment)
2. Test that image verification works end-to-end
3. Test that AI volunteer selection runs

**Verification:**
```bash
# Check if key is loaded
python -c "from backend import config; print(config.GEMINI_API_KEY)"

# Should NOT print None
```

**Impact:** 
- Without this, image verification is bypassed
- Volunteer selection falls back to deterministic scoring
- System is not AI-powered

---

### P1.2: Enforce Image Verification in DISASTER Mode
- **Severity:** CRITICAL  
- **Status:** BROKEN - Backend allows creation without image
- **File:** `backend/routers/tasks.py` lines 107-115

**Current Code:**
```python
if mode == "DISASTER" and not payload.image_data:
    # Allow creation but mark as not_submitted
    pass
```

**Fix Required:**
```python
if mode == "DISASTER" and not payload.image_data:
    raise HTTPException(
        status_code=400, 
        detail="DISASTER mode requires image verification. Please upload evidence photo."
    )
```

**Testing:**
```python
# Test 1: Create DISASTER without image → should fail with 400
response = client.post("/api/tasks", {
    "mode": "DISASTER",
    "incident_type": "Fire",
    "title": "Test",
    "description": "Test",
    "required_skills": [],
    "people_count": 1,
    "lat": 17.3850,
    "lng": 78.4867,
    "image_data": None  # ← Should be rejected
})
assert response.status_code == 400

# Test 2: Create DISASTER with image → should succeed
response = client.post("/api/tasks", {
    # ... all fields same ...
    "image_data": "data:image/png;base64,..."
})
assert response.status_code == 200
```

**Impact:**
- Without this, users can bypass safety check
- "DISASTER mode" becomes meaningless
- Image verification component is useless

---

### P1.3: Fix Analytics Fake Data Generation
- **Severity:** MEDIUM (Demo-breaking)
- **Status:** BROKEN - Chart data is randomly generated
- **File:** `frontend/src/pages/Analytics.tsx` lines 32-45

**Current Code:**
```typescript
const generateTimeSeriesData = () => {
    const hours = Array.from({ length: 12 }, (_, i) => {
        const hour = i * 2;
        return {
            time: `${String(hour).padStart(2, "0")}:00`,
            created: Math.floor(Math.random() * 15) + 5,  // ← RANDOM
            completed: Math.floor(Math.random() * 12) + 2, // ← RANDOM
            active: Math.floor(Math.random() * 20) + 10,
            volunteers: Math.floor(Math.random() * 8) + 2,
        };
    });
    return hours;
};
```

**Fix Required:**

Option A: Query real data from backend
```typescript
const [timeSeriesData, setTimeSeriesData] = useState([]);

useEffect(() => {
    analyticsApi.dashboard().then(dash => {
        // Convert dashboard data to time-series
        // Use recent_activity or build from task creation times
        const series = dash.recent_activity.map(activity => ({
            time: new Date(activity.time).toLocaleTimeString(),
            created: dash.tasks_by_status["pending"] ?? 0,
            completed: dash.tasks_by_status["completed"] ?? 0,
            // ... more fields
        }));
        setTimeSeriesData(series);
    });
}, []);
```

Option B: Add new backend endpoint for time-series
```python
@router.get("/api/analytics/timeseries", response_model=list[TimeSeriesData])
def analytics_timeseries(hours: int = 24, db: Session = Depends(get_db)):
    """Return actual task creation/completion over time."""
    tasks = db.scalars(
        select(models.Request)
        .order_by(models.Request.created_at)
    ).all()
    
    # Aggregate by hour
    series = []
    for hour in range(-hours, 0):
        time_start = datetime.utcnow() - timedelta(hours=-hour)
        time_end = time_start + timedelta(hours=1)
        
        created_count = len([
            t for t in tasks 
            if time_start <= t.created_at < time_end
        ])
        # ... more aggregations
        
    return series
```

**Testing:**
```bash
# Check actual data is being queried
# Open browser console
# Verify fetch calls /api/analytics/timeseries
// Should see network request with 200 response
```

**Impact:**
- Without this, judges see fake random data
- Can't validate system actually works in production
- Analytics page appears non-functional

---

## Priority 2: SHOULD FIX BEFORE FINAL JUDGING (1-2 hours)

### P2.1: Add Per-Volunteer Decision Reasoning
- **Severity:** MEDIUM
- **Status:** PARTIAL - Reasoning exists but not exposed
- **File:** `backend/routers/tasks.py` and `frontend` pages

**Current:** Shows assignment reason but not AI trace

**Fix Required:**
Add decision trace to Assignment response:
```python
class AssignmentRead(BaseModel):
    id: int
    volunteer_id: int
    score: float
    reason: str
    decision_trace: Optional[str] = None  # ← NEW
    ai_factors: Optional[dict] = None      # ← NEW
```

```python
# In assignment creation
assignment = models.Assignment(
    reason=reason,
    decision_trace={
        "skill_match": skill_score,
        "distance_km": distance_km,
        "availability": avail_score,
        "rating": rating_score,
        "final_score": final_score,
        "weighted_factors": {
            "skill": skill_score * weight_skill,
            "distance": dist_score * weight_dist,
            # ...
        }
    }
)
```

---

### P2.2: Add Skill Gap Analysis
- **Severity:** MEDIUM
- **Status:** NOT IMPLEMENTED
- **Files:** 
  - `backend/routers/analytics.py` (new endpoint)
  - `frontend/src/pages/Analytics.tsx` (new section)

**Missing Feature:**
```
Current tasks require: [Medical, Rescue]
Available volunteers with Medical: 5
Available volunteers with Rescue: 3
Volunteers with both: 1

Recommendation: Recruit 2 more Medical + 4 more Rescue volunteers
```

**Implementation:**
```python
@router.get("/api/analytics/skill-gap")
def skill_gap_analysis(db: Session = Depends(get_db)):
    """Analyze gap between required and available skills."""
    
    # Get all required skills across active tasks
    active_tasks = db.scalars(
        select(models.Request)
        .where(models.Request.status != "completed")
    ).all()
    
    required_by_skill = {}
    for task in active_tasks:
        for skill in task.skills:
            required_by_skill[skill.name] = required_by_skill.get(skill.name, 0) + 1
    
    # Get volunteer supply by skill
    supply_by_skill = {}
    volunteers = db.scalars(select(models.User).where(models.User.role == "volunteer")).all()
    for vol in volunteers:
        if vol.availability and vol.status == "available":
            for skill in vol.skills:
                supply_by_skill[skill.name] = supply_by_skill.get(skill.name, 0) + 1
    
    # Calculate gaps
    gaps = []
    for skill, required in required_by_skill.items():
        supply = supply_by_skill.get(skill, 0)
        gap = max(0, required - supply)
        if gap > 0:
            gaps.append({
                "skill": skill,
                "required": required,
                "available": supply,
                "gap": gap,
                "priority": "HIGH" if gap >= required else "MEDIUM"
            })
    
    return sorted(gaps, key=lambda x: x["gap"], reverse=True)
```

---

### P2.3: Persist Mock Data to File
- **Severity:** LOW (Demo-only issue)
- **Status:** NOT IMPLEMENTED - Data resets on server restart
- **File:** `backend/database.py` and `backend/main.py`

**Current:**
```python
engine = create_engine(
    "sqlite+pysqlite:///:memory:",  # ← In-memory, not persisted
    ...
)
```

**Fix Required:**
```python
# Option 1: Use file-based SQLite for demo
if config.USE_MOCK_DATA:
    db_path = Path(__file__).parent / "demo_data.db"
    engine = create_engine(
        f"sqlite:///{db_path}",
        ...
    )
else:
    # MySQL/Postgres for production
```

**Impact:**
- Without this, data is lost when server restarts
- Can't show persistence to judges
- Good for demos though (clean slate each time)

---

## Priority 3: NICE TO HAVE (Post-Demo Enhancements)

### P3.1: Add Volunteer Rating System
- **Status:** INCOMPLETE - Rating model exists but not fully wired
- **File:** `backend/models.py` (Rating model exists)
- **Missing:** UI for rating, endpoint for submitting ratings

### P3.2: Add Support Vote Visualization
- **Status:** INCOMPLETE - Support votes are tracked but not shown
- **File:** `backend/models.py` (SupportVote model exists)
- **Missing:** UI component showing who voted, vote count animation

### P3.3: Add Request Reassignment When Volunteer Declines
- **Status:** PARTIAL - Logic exists but may have edge cases
- **File:** `backend/services/assignment_engine.py` - reassign_request()
- **Issue:** Need to test with multiple volunteers declining

### P3.4: Add Geographic Clustering Display
- **Status:** PARTIAL - Markers clustered in map but no cluster metrics
- **Missing:** Show "15 tasks in this cluster" when zoomed out

---

## Test Checklist After Fixes

```markdown
## P1 Fixes (Critical - Must Work)

### Gemini API
- [ ] Uncomment and set valid Gemini API key
- [ ] Restart backend
- [ ] Create DISASTER task with image
- [ ] Check logs: image_verification called (not skipped)
- [ ] Response shows: is_disaster, confidence, labels, reason
- [ ] Verify volunteer selection uses AI (not fallback)

### Image Enforcement
- [ ] Try to create DISASTER task without image
- [ ] Should receive 400 error: "DISASTER mode requires image"
- [ ] Create DISASTER task WITH image
- [ ] Should succeed with 200 + auto-assigned volunteers
- [ ] Try NGO mode without image
- [ ] Should succeed (image not required)

### Analytics Data
- [ ] Open /analytics page
- [ ] Check network tab: /api/analytics/timeseries called
- [ ] Trends should match real activity (not random)
- [ ] Refresh page: trends should be SAME (not random)
- [ ] Create 5 tasks
- [ ] Wait 10 seconds for refresh
- [ ] Chart should show 5 new tasks (not random number)

## P2 Fixes (Quality)

### Decision Reasoning
- [ ] Click on assignment in UI
- [ ] Should show detailed decision breakdown
- [ ] Example: "Skill match: 0.8, Distance: 0.9, Rating: 0.95 = 0.87 score"

### Skill Gap Analysis
- [ ] Open /analytics
- [ ] New "Skill Gap" section visible
- [ ] Shows which skills are in short supply
- [ ] Recommendation for recruitment

### Data Persistence
- [ ] Create 10 tasks
- [ ] Restart backend server
- [ ] Check: All 10 tasks still visible
- [ ] Demo refresh doesn't lose data
```

---

## Debugging Tips

### For Gemini API Issues

```python
# Test if API key is loaded
python -c "from backend.config import GEMINI_API_KEY; print(GEMINI_API_KEY)"

# Test if Gemini model can be instantiated
python -c "
from backend.services.gemini_service import _load_gemini_model
model = _load_gemini_model()
print('Model loaded:', model is not None)
"

# Test image verification directly
python -c "
from backend.services.gemini_service import verify_image
result = verify_image('data:image/png;base64,iVBORw0K...')
print(result)
"
```

### For Analytics Issues

```python
# Check if tasks are actually being created
python -c "
from backend.database import SessionLocal
from backend.models import Request
db = SessionLocal()
tasks = db.query(Request).all()
print(f'Total tasks: {len(tasks)}')
for t in tasks:
    print(f'  {t.id}: {t.title} ({t.created_at})')
"

# Check analytics endpoint
curl http://localhost:8000/api/analytics/dashboard
```

### For Image Verification Issues

```python
# Test image validation
python -c "
from backend.services.image_verification import verify_image_data
status, reason, url = verify_image_data(None)
print(f'No image: {status}, {reason}')

# Test with fake base64
status, reason, url = verify_image_data('data:image/png;base64,INVALID')
print(f'Invalid: {status}, {reason}')
"
```

---

## Final Checklist Before Demo

- [ ] All P1 issues fixed
- [ ] Server starts without errors
- [ ] Database has mock data
- [ ] Map renders with markers
- [ ] Can create DISASTER task (requires image)
- [ ] Can create NGO task (no image required)
- [ ] Volunteers auto-assigned for DISASTER
- [ ] Dashboard shows real metrics (not random)
- [ ] Can accept/decline NGO tasks
- [ ] Assignment reasons are shown
- [ ] Analytics show real data over time
- [ ] Navigation between pages works
- [ ] No console errors in browser

**If all checked:** Ready for demo! ✅
