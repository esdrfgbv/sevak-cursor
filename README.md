# SEVAK - Smart Emergency Volunteer & Assistance Kit

A real-time disaster response and volunteer coordination platform powered by Firebase and AI.

## 🚀 Live Demo

- **Frontend**: [Deploy on Firebase Hosting](#deploy-frontend-to-firebase)
- **Backend API**: [Deploy on Render](#deploy-backend-to-render)

## 📋 Features

- **AI-Powered Image Verification** - Google Gemini validates disaster images
- **Smart Volunteer Assignment** - Distance-based matching within 50km radius
- **Real-time Tracking** - Live volunteer and request status updates
- **Priority Scoring** - Automated urgency calculation based on multiple factors
- **Multi-Role Support** - Admin, Requester, and Volunteer dashboards
- **Cluster Detection** - Identifies concentrated disaster zones

## 🛠️ Tech Stack

### Frontend
- React + TypeScript + Vite
- Tailwind CSS + shadcn/ui
- Firebase Hosting

### Backend
- FastAPI (Python 3.13)
- Firebase Firestore
- Google Gemini AI
- Render Cloud

## 📦 Project Structure

```
sevak/
├── backend/                 # FastAPI backend
│   ├── models/             # Data models
│   ├── routers/            # API endpoints
│   ├── services/           # Business logic
│   │   ├── firebase_service.py    # Firebase operations
│   │   ├── firebase_seeder.py     # Demo data seeder
│   │   ├── assignment_engine.py   # Volunteer matching
│   │   └── gemini_service.py      # AI verification
│   ├── main.py             # App entry point
│   ├── requirements.txt    # Python dependencies
│   └── firebase-credentials.json  # (Gitignored)
│
├── frontend/               # React frontend
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── pages/          # Page components
│   │   ├── services/       # API services
│   │   └── App.tsx         # Main app
│   ├── package.json
│   └── vite.config.ts
│
├── .gitignore
└── README.md
```

## 🚀 Quick Start

### Prerequisites

- Node.js 20+ and npm
- Python 3.13+
- Firebase account
- Google Gemini API key

### Local Development

#### Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\Activate.ps1

# Install dependencies
pip install -r requirements.txt

# Set up environment variables
cp .env.example .env
# Edit .env with your Firebase credentials and Gemini API key

# Run server
python -m uvicorn main:app --reload
```

Backend runs at: `http://localhost:8000`

#### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your backend API URL

# Run dev server
npm run dev
```

Frontend runs at: `http://localhost:5173`

## 🌐 Deployment

### Deploy Backend to Render

1. **Create Render Account**
   - Go to [render.com](https://render.com)
   - Sign up with GitHub

2. **Prepare Backend**
   ```bash
   # Ensure these files exist:
   - backend/requirements.txt
   - backend/main.py
   - backend/runtime.txt  # Python version
   ```

3. **Create Web Service on Render**
   - Click "New +" → "Web Service"
   - Connect your GitHub repository
   - Configure:
     - **Name**: sevak-backend
     - **Region**: Choose nearest to users
     - **Branch**: main
     - **Root Directory**: `backend`
     - **Runtime**: Python 3
     - **Build Command**: `pip install -r requirements.txt`
     - **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`

4. **Add Environment Variables in Render**
   ```
   FIREBASE_PROJECT_ID=your-project-id
   FIREBASE_CREDENTIALS_PATH=./firebase-credentials.json
   GEMINI_API_KEY=your-gemini-api-key
   GEMINI_VISION_MODEL=gemini-1.5-flash
   BASE_LAT=17.3850
   BASE_LNG=78.4867
   DEMO_RADIUS_KM=20
   MAX_ASSIGNMENT_DISTANCE_KM=50
   ```

5. **Upload Firebase Credentials**
   - In Render dashboard, go to your service
   - Click "Secrets" → "Add Secret File"
   - File name: `firebase-credentials.json`
   - Paste your Firebase service account JSON

6. **Deploy**
   - Click "Create Web Service"
   - Wait for deployment to complete
   - Copy your backend URL (e.g., `https://sevak-backend.onrender.com`)

### Deploy Frontend to Firebase

1. **Install Firebase CLI**
   ```bash
   npm install -g firebase-tools
   ```

2. **Login to Firebase**
   ```bash
   firebase login
   ```

3. **Initialize Firebase in Frontend**
   ```bash
   cd frontend
   firebase init hosting
   ```
   
   Configuration:
   - **Project**: Use existing project or create new
   - **Public directory**: `dist`
   - **Single-page app**: Yes
   - **GitHub integration**: No (manual deploy)

4. **Update Frontend Environment**
   ```bash
   # Create .env.production
   echo "VITE_API_URL=https://your-backend-url.onrender.com" > .env.production
   ```

5. **Build Frontend**
   ```bash
   npm run build
   ```

6. **Deploy to Firebase**
   ```bash
   firebase deploy --only hosting
   ```

   Your site will be live at: `https://your-project.web.app`

## 🔧 Environment Variables

### Backend (.env)

```env
# Firebase Configuration
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CREDENTIALS_PATH=./firebase-credentials.json

# Gemini AI
GEMINI_API_KEY=your-gemini-api-key
GEMINI_VISION_MODEL=gemini-1.5-flash

# Location Settings (Hyderabad default)
BASE_LAT=17.3850
BASE_LNG=78.4867
DEMO_RADIUS_KM=20
MAX_ASSIGNMENT_DISTANCE_KM=50
```

### Frontend (.env)

```env
VITE_API_URL=http://localhost:8000  # Local
VITE_API_URL=https://your-backend.onrender.com  # Production
```

## 📊 API Documentation

Once backend is running, visit:
- **Swagger UI**: `http://localhost:8000/docs`
- **ReDoc**: `http://localhost:8000/redoc`

## 🎯 Key Features

### Distance-Based Assignment
- All volunteers within 20km demo radius
- Hard 50km limit for assignments
- Smart scoring: distance + skills + availability + rating

### AI Image Verification
- Google Gemini validates disaster images
- Prevents false reports
- Confidence scoring system

### Auto-Scaling
- Firebase Firestore handles millions of requests
- Render auto-scales backend
- Firebase CDN for frontend

## 🔐 Security

- Firebase security rules for database access
- CORS configuration for API
- Environment variables for secrets
- No hardcoded credentials

## 📈 Monitoring

- **Backend**: Render dashboard logs
- **Frontend**: Firebase hosting analytics
- **Database**: Firebase console

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Commit changes
4. Push to branch
5. Open Pull Request

## 📝 License

MIT License

## 🆘 Support

For issues and questions:
- Create an issue on GitHub
- Check API documentation at `/docs`
- Review Firebase console for database issues

## 🎉 Acknowledgments

- Google Gemini for AI capabilities
- Firebase for real-time database
- FastAPI for backend framework
- React ecosystem for frontend
