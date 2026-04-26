from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import config, schemas
from .routers import analytics, assignments, assignments_api, requests, tasks, users, volunteers
from .routers.auth import router as auth_router
from .services.firebase_seeder import seed_firebase_demo_data


@asynccontextmanager
async def lifespan(_: FastAPI):
    # Initialize Firebase and seed demo data on startup
    print("🚀 Starting SEVAK with Firebase backend...")
    try:
        seed_firebase_demo_data()
        print("✅ Firebase initialized and demo data ready")
    except Exception as e:
        print(f"⚠️  Firebase initialization warning: {e}")
    yield


app = FastAPI(title="SEVAK API", version="3.0.0-Firebase", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def health():
    return {
        "message": "SEVAK backend online (Firebase)",
        "firebase_project": config.FIREBASE_PROJECT_ID or "not configured",
        "demo_radius_km": config.DEMO_RADIUS_KM,
        "max_assignment_distance_km": config.MAX_ASSIGNMENT_DISTANCE_KM
    }


# ── API Routers ──
app.include_router(auth_router)
app.include_router(tasks.router)
app.include_router(volunteers.router)
app.include_router(assignments_api.router)
app.include_router(analytics.router)
app.include_router(requests.router)
app.include_router(users.router)
app.include_router(assignments.router)
