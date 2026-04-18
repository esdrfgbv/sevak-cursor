# Sevak — Volunteer Coordination Platform (Prototype)

This is a working prototype of the **Smart Resource Allocation / Volunteer Coordination Platform** described in `Volunteer_Coordination_Complete_Technical_Report.md`.

## Services

- **Frontend**: React (Vite) `frontend/`
- **Backend API**: Node.js + Express + TypeScript `backend/`
- **Matching Engine**: FastAPI `matching-engine/`
- **Infra** (local): Postgres(+pgcrypto), Redis, MongoDB, matching-engine `infra/`

## Prereqs

- Node.js 20+ (recommended 22+)
- Python 3.10+
- Docker Desktop (for Postgres/Redis/Mongo)  
  - If Docker isn’t running, the backend will still start, but DB-backed endpoints won’t work.

## Quick start (local)

### 1) Start infrastructure (Docker)

From `infra/`:

```bash
docker compose up -d
```

### 2) Start matching engine (optional if using Docker compose build)

```bash
cd matching-engine
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### 3) Start backend

```bash
cd backend
copy .env.example .env
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

Backend runs on `http://localhost:3001`.

### 4) Start frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on `http://localhost:5173` and proxies `/api/*` and websocket traffic to the backend.

## Demo accounts (seeded)

Password for all: `Password123!`

- Coordinator: `coordinator@sevak.local`
- Admin: `admin@sevak.local`
- Volunteers: `volunteer1@sevak.local` … `volunteer10@sevak.local`

## Implemented feature set (MVP)

- JWT auth (`/api/auth/register|login|refresh`)
- Volunteer directory + profile updates + skills + assignments view
- Task CRUD + list filters + CSV bulk upload
- Matching endpoint (`/api/tasks/:id/match`) with Redis caching when available
- Assignment lifecycle: assign → accept/decline → complete → rate
- Coordinator analytics endpoints + basic UI dashboards
- Realtime updates (Socket.io rooms) for tasks and volunteer status

