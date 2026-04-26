# SEVAK - Clean Project Structure

## 📁 Current Structure

```
sevak/
│
├── 📄 README.md                    # Main documentation
├── 📄 DEPLOYMENT.md                # Complete deployment guide
├── 📄 .gitignore                   # Git ignore rules
├── 📄 deploy-commands.txt          # Quick deployment reference
│
├── 📂 backend/                     # FastAPI Backend
│   ├── 📄 main.py                  # App entry point
│   ├── 📄 requirements.txt         # Python dependencies
│   ├── 📄 runtime.txt              # Python version for Render
│   ├── 📄 build.sh                 # Render build script
│   ├── 📄 start.sh                 # Render start script
│   ├── 📄 .env.example             # Environment template
│   ├── 📄 firebase-credentials.json # (GITIGNORED - Your secret)
│   │
│   ├── 📂 models/                  # Data models
│   │   └── 📄 __init__.py
│   │
│   ├── 📂 routers/                 # API endpoints
│   │   ├── 📄 analytics.py
│   │   ├── 📄 assignments.py
│   │   ├── 📄 assignments_api.py
│   │   ├── 📄 auth.py
│   │   ├── 📄 requests.py
│   │   ├── 📄 tasks.py
│   │   ├── 📄 users.py
│   │   └── 📄 volunteers.py
│   │
│   ├── 📂 services/                # Business logic
│   │   ├── 📄 firebase_service.py      # Firebase CRUD operations
│   │   ├── 📄 firebase_seeder.py       # Demo data seeder
│   │   ├── 📄 assignment_engine.py     # Volunteer matching
│   │   ├── 📄 gemini_service.py        # AI image verification
│   │   ├── 📄 cluster_service.py
│   │   ├── 📄 incident_matching.py
│   │   ├── 📄 priority_engine.py
│   │   ├── 📄 state_manager.py
│   │   └── 📄 vision_pipeline.py
│   │
│   └── 📂 utils/                   # Helper functions
│       └── 📄 geo.py
│
└── 📂 frontend/                    # React Frontend
    ├── 📄 package.json
    ├── 📄 vite.config.ts
    ├── 📄 firebase.json            # Firebase hosting config
    ├── 📄 .env.example             # Environment template
    ├── 📄 .env.production          # Production env (update URL)
    │
    ├── 📂 src/
    │   ├── 📄 App.tsx              # Main app component
    │   ├── 📄 main.tsx             # Entry point
    │   ├── 📄 index.css            # Global styles
    │   │
    │   ├── 📂 components/          # React components
    │   │   ├── 📂 layout/
    │   │   ├── 📂 ui/
    │   │   └── 📂 widgets/
    │   │
    │   ├── 📂 pages/               # Page components
    │   │   ├── 📄 Analytics.tsx
    │   │   ├── 📄 Index.tsx
    │   │   ├── 📄 Login.tsx
    │   │   ├── 📄 MapView.tsx
    │   │   ├── 📄 RequesterDashboard.tsx
    │   │   ├── 📄 Tasks.tsx
    │   │   ├── 📄 VolunteerDashboard.tsx
    │   │   └── 📄 Volunteers.tsx
    │   │
    │   ├── 📂 services/            # API services
    │   │   ├── 📄 location.ts
    │   │   └── 📄 gemini-service.ts
    │   │
    │   ├── 📂 contexts/            # React contexts
    │   │   └── 📄 AuthContext.tsx
    │   │
    │   └── 📂 lib/                 # Utilities
    │       ├── 📄 api.ts
    │       ├── 📄 utils.ts
    │       └── 📄 mock-data.ts
    │
    └── 📂 public/                  # Static assets
        ├── 📄 index.html
        └── 📄 favicon.ico
```

## ✅ What's Included

### Core Files
- ✅ Complete backend with Firebase integration
- ✅ Complete frontend with React + TypeScript
- ✅ Deployment configurations
- ✅ Environment templates
- ✅ Comprehensive documentation

### Deployment Ready
- ✅ Render configuration (backend)
- ✅ Firebase Hosting configuration (frontend)
- ✅ Environment variable templates
- ✅ Build and start scripts
- ✅ .gitignore for security

### Documentation
- ✅ README.md - Project overview and quick start
- ✅ DEPLOYMENT.md - Step-by-step deployment guide
- ✅ deploy-commands.txt - Quick reference

## 🚫 What's Removed

- ❌ Old mock data files
- ❌ SQLite database files
- ❌ Unnecessary documentation (audit reports, etc.)
- ❌ Old version directories
- ❌ Development caches
- ❌ Build artifacts

## 🔐 Secret Files (Gitignored)

These files contain secrets and are NOT committed to Git:

- `backend/firebase-credentials.json` - Firebase service account
- `backend/.env` - Backend environment variables
- `frontend/.env` - Frontend environment variables
- `frontend/.env.production` - Production configuration

## 📦 Next Steps

1. **Set up Firebase**
   - Create project at console.firebase.google.com
   - Enable Firestore Database
   - Download service account key → `backend/firebase-credentials.json`

2. **Get Gemini API Key**
   - Create key at aistudio.google.com
   - Add to backend environment

3. **Deploy Backend**
   - Push to GitHub
   - Create Render web service
   - Add environment variables
   - Upload firebase-credentials.json as secret

4. **Deploy Frontend**
   - Update `frontend/.env.production` with backend URL
   - Build: `npm run build`
   - Deploy: `firebase deploy --only hosting`

5. **Test**
   - Visit your Firebase hosting URL
   - Create test request
   - Verify volunteer assignment

## 💡 Quick Commands

```bash
# Start backend locally
cd backend
python -m uvicorn main:app --reload

# Start frontend locally
cd frontend
npm run dev

# Build for production
cd frontend
npm run build

# Deploy frontend
firebase deploy --only hosting

# Deploy backend
git push origin main  # Auto-deploys to Render
```

## 📊 Tech Stack

**Frontend:**
- React 18 + TypeScript
- Vite (build tool)
- Tailwind CSS + shadcn/ui
- Firebase Hosting

**Backend:**
- FastAPI (Python 3.13)
- Firebase Firestore
- Google Gemini AI
- Render Cloud

**Database:**
- Firebase Firestore (NoSQL)
- Real-time sync
- Automatic scaling

## 🎯 Features

- AI-powered image verification
- Smart volunteer assignment (50km radius)
- Real-time tracking
- Priority scoring
- Multi-role dashboards
- Cluster detection

---

**Ready to deploy? Follow DEPLOYMENT.md!** 🚀
