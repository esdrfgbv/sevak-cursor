# 🚀 SEVAK Deployment Guide

Complete step-by-step guide to deploy SEVAK to production.

---

## 📋 Prerequisites

1. **Accounts Needed:**
   - GitHub account
   - Firebase account (free tier works)
   - Render account (free tier works)
   - Google Gemini API key

2. **Install Locally:**
   ```bash
   # Node.js and npm
   node --version  # Should be 20+
   
   # Python
   python --version  # Should be 3.13+
   
   # Firebase CLI
   npm install -g firebase-tools
   ```

---

## 🔧 Step 1: Get Firebase Credentials

### 1.1 Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Click "Add project"
3. Name: `sevak-disasteriq`
4. Disable Google Analytics (optional)
5. Create project

### 1.2 Enable Firestore Database

1. In Firebase Console, click "Firestore Database"
2. Click "Create database"
3. Start in **test mode** (we'll secure it later)
4. Choose location: `asia-south1` (Mumbai) or nearest to users

### 1.3 Get Service Account Key

1. Go to Project Settings ⚙️ → Service Accounts
2. Click "Generate new private key"
3. Download JSON file
4. **IMPORTANT**: This file is secret - never commit to Git!

### 1.4 Set Firestore Security Rules

Go to Firestore → Rules and paste:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow all reads/writes for demo
    // Restrict in production!
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

---

## 🔑 Step 2: Get Gemini API Key

1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Sign in with Google account
3. Click "Create API key"
4. Copy the key (starts with `AIza...`)
5. Set aside for backend configuration

---

## 🖥️ Step 3: Deploy Backend to Render

### 3.1 Push Code to GitHub

```bash
# In your project root
git init
git add .
git commit -m "Initial commit - SEVAK deployment ready"

# Create repository on GitHub, then:
git remote add origin https://github.com/YOUR_USERNAME/sevak.git
git push -u origin main
```

### 3.2 Create Render Account

1. Go to [render.com](https://render.com)
2. Click "Get Started" → Sign up with GitHub
3. Authorize Render to access your repositories

### 3.3 Create Web Service

1. Click "New +" → "Web Service"
2. Click "Connect" next to your `sevak` repository
3. Configure:

   **Basic Settings:**
   - Name: `sevak-backend`
   - Region: Choose nearest to your users
   - Branch: `main`
   - Root Directory: `backend`
   - Runtime: `Python 3`

   **Build & Deploy:**
   - Build Command: `pip install -r requirements.txt`
   - Start Command: `uvicorn main:app --host 0.0.0.0 --port $PORT`

   **Instance Type:**
   - Free (good for demo)
   - Or choose Starter ($7/mo) for better performance

### 3.4 Add Environment Variables

In Render dashboard, go to your service → Environment → Add these:

```env
FIREBASE_PROJECT_ID=sevak-disasteriq
FIREBASE_CREDENTIALS_PATH=./firebase-credentials.json
GEMINI_API_KEY=AIza...YOUR_KEY_HERE
GEMINI_VISION_MODEL=gemini-1.5-flash
BASE_LAT=17.3850
BASE_LNG=78.4867
DEMO_RADIUS_KM=20
MAX_ASSIGNMENT_DISTANCE_KM=50
```

### 3.5 Upload Firebase Credentials

1. In Render dashboard, go to your service
2. Click "Secrets" tab
3. Scroll to "Secret Files"
4. Click "Add Secret File"
5. File name: `firebase-credentials.json`
6. Open your downloaded Firebase JSON file
7. Copy entire contents
8. Paste into the secret file value
9. Click "Save"

### 3.6 Deploy

1. Click "Create Web Service"
2. Wait 3-5 minutes for deployment
3. Check logs for any errors
4. Once deployed, copy your URL:
   ```
   https://sevak-backend.onrender.com
   ```

### 3.7 Test Backend

Visit these URLs:
- Health check: `https://sevak-backend.onrender.com/`
- API docs: `https://sevak-backend.onrender.com/docs`
- Volunteers: `https://sevak-backend.onrender.com/volunteers`

**Expected response from health check:**
```json
{
  "message": "SEVAK backend online (Firebase)",
  "firebase_project": "sevak-disasteriq",
  "demo_radius_km": 20.0,
  "max_assignment_distance_km": 50.0
}
```

---

## 🌐 Step 4: Deploy Frontend to Firebase

### 4.1 Update Frontend Environment

```bash
cd frontend

# Create production env file
echo "VITE_API_URL=https://sevak-backend.onrender.com" > .env.production

# Replace with your actual Render backend URL
```

### 4.2 Install Firebase CLI (if not done)

```bash
npm install -g firebase-tools
```

### 4.3 Login to Firebase

```bash
firebase login
```

This will open browser - login with your Google account.

### 4.4 Initialize Firebase Hosting

```bash
cd frontend
firebase init hosting
```

**Configuration:**
- **Project:** Use an existing project → Select `sevak-disasteriq`
- **Public directory:** `dist`
- **Configure as single-page app:** Yes
- **Set up automatic builds:** No
- **File dist/index.html already exists:** Overwrite → No

This creates `firebase.json` (already included in repo).

### 4.5 Build Frontend

```bash
# Install dependencies (if not done)
npm install

# Build for production
npm run build
```

This creates a `dist/` folder with optimized files.

### 4.6 Deploy to Firebase

```bash
firebase deploy --only hosting
```

**Expected output:**
```
✔  Deploy complete!

Project Console: https://console.firebase.google.com/project/sevak-disasteriq/overview
Hosting URL: https://sevak-disasteriq.web.app
```

### 4.7 Custom Domain (Optional)

1. Go to Firebase Console → Hosting
2. Click "Add custom domain"
3. Follow DNS configuration steps
4. Wait for SSL certificate (up to 24 hours)

---

## ✅ Step 5: Verify Deployment

### 5.1 Test Frontend

1. Open your Firebase hosting URL
2. Try logging in (use demo credentials)
3. Create a test request
4. Check if volunteers are assigned

### 5.2 Test Backend API

```bash
# Test health endpoint
curl https://your-backend.onrender.com/

# Test volunteers endpoint
curl https://your-backend.onrender.com/volunteers

# Test requests endpoint
curl https://your-backend.onrender.com/requests
```

### 5.3 Check Firebase Console

1. Go to Firebase Console → Firestore Database
2. Verify collections exist:
   - `users` (53 documents)
   - `requests` (20 documents)
   - `skills` (16 documents)
   - `assignments` (created when assignments happen)

---

## 🔒 Step 6: Production Security (Recommended)

### 6.1 Update Firestore Rules

Replace test mode rules with:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow reads for everyone (public data)
    match /{document=**} {
      allow read: if true;
    }
    
    // Restrict writes in production
    match /users/{userId} {
      allow write: if request.auth != null;
    }
    
    match /requests/{requestId} {
      allow create: if true;  // Allow public requests
      allow update, delete: if request.auth != null;
    }
    
    match /assignments/{assignmentId} {
      allow write: if request.auth != null;
    }
    
    match /skills/{skillId} {
      allow write: if false;  // Only admins can modify
    }
  }
}
```

### 6.2 Enable Firebase Authentication (Optional)

For production user management:
1. Firebase Console → Authentication
2. Enable Email/Password or Google sign-in
3. Update backend to verify Firebase tokens

### 6.3 Set Up CORS in Backend

Update `backend/main.py` CORS settings:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://your-app.web.app"],  # Your Firebase URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

---

## 📊 Step 7: Monitor Your App

### 7.1 Backend Monitoring

- **Render Dashboard**: View logs, metrics, and health
- **Uptime**: Free tier sleeps after 15 min inactivity
- **Upgrade**: $7/mo for always-on service

### 7.2 Frontend Monitoring

- **Firebase Console**: View hosting metrics
- **Analytics**: Enable Google Analytics
- **CDN**: Firebase uses global CDN automatically

### 7.3 Database Monitoring

- **Firestore Console**: View usage, reads/writes
- **Free Tier Limits**:
  - 50,000 reads/day
  - 20,000 writes/day
  - 1 GB storage

---

## 🔄 Updating Your App

### Update Backend

```bash
# Make changes to backend code
git add .
git commit -m "Update backend feature"
git push origin main

# Render auto-deploys on push to main branch
```

### Update Frontend

```bash
# Make changes to frontend code
cd frontend
npm run build
firebase deploy --only hosting
```

---

## 🐛 Troubleshooting

### Backend Issues

**Problem**: Backend won't start
```bash
# Check Render logs
# Look for:
- Missing environment variables
- Firebase credentials error
- Python dependency issues
```

**Problem**: Firebase connection fails
```bash
# Verify:
- firebase-credentials.json uploaded as secret file
- FIREBASE_PROJECT_ID matches your project
- Firestore database is enabled
```

### Frontend Issues

**Problem**: Can't connect to backend
```bash
# Check:
- VITE_API_URL in .env.production is correct
- Backend is running and accessible
- CORS is properly configured
```

**Problem**: Build fails
```bash
# Check:
- All dependencies installed: npm install
- No TypeScript errors
- Environment variables are set
```

---

## 💰 Cost Estimate

### Free Tier (Demo)
- **Firebase Hosting**: Free (10 GB storage, 360 MB/day transfer)
- **Firestore**: Free (50K reads/day, 20K writes/day)
- **Render**: Free (750 hours/month, sleeps after 15 min)
- **Gemini AI**: Free (60 requests/min)

**Total: $0/month** (perfect for demo/hackathon)

### Production Tier
- **Firebase Hosting**: $0.026/GB after 10GB
- **Firestore**: $0.06/100K reads after free tier
- **Render**: $7/month (Starter plan, always-on)
- **Gemini AI**: Pay per use after free tier

**Total: ~$10-20/month** (for moderate usage)

---

## 🎉 You're Live!

Your SEVAK platform is now deployed and accessible worldwide!

**Share your app:**
- Frontend: `https://your-project.web.app`
- Backend API: `https://your-backend.onrender.com`
- API Docs: `https://your-backend.onrender.com/docs`

**Next steps:**
1. Test all features end-to-end
2. Share with users
3. Monitor usage and performance
4. Iterate and improve!

---

## 📞 Support

- **Documentation**: See README.md
- **API Reference**: `/docs` endpoint
- **Issues**: Create GitHub issue
- **Firebase**: [Firebase Support](https://firebase.google.com/support)
- **Render**: [Render Support](https://render.com/docs)
