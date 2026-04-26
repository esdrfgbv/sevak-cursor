# SEVAK – Smart Resource Allocation System

## 🚀 Overview

- **Problem**: Disaster + NGO teams lose time because requests, locations, and volunteer availability live in different places.
- **Why current systems fail**: manual triage, stale location data, and “first-come-first-serve” volunteer selection.
- **What SEVAK does**: one platform that verifies evidence (image), scores urgency, and assigns nearby volunteers using explainable matching rules.

---

## 🎯 Problem Statement

- **Scattered data**: requests, volunteers, and status updates are not centralized.
- **Slow response coordination**: triage and dispatch happen over calls/chats.
- **Inefficient volunteer allocation**: skill fit and distance are not enforced consistently.
- **No intelligent decision-making systems**: urgency and assignment rules are not encoded.

---

## 💡 Solution

- **Centralized platform**: one dashboard for tasks, assignments, volunteers, and analytics.
- **AI-powered validation (Google Gemini)**: DISASTER tasks can require a photo; Gemini Vision helps validate evidence.
- **Smart assignment engine**: algorithmic selection using distance + skills + availability + rating.
- **Real-time coordination system**: status changes flow end-to-end via APIs and Firestore-backed data.

---

## ⚙️ Features

- **AI Image Verification (Google Gemini Vision)**
- **Smart Volunteer Assignment Engine**
- **Real-time Task Dashboard**
- **Role-based Access (Admin / Requester / Volunteer)**
- **Priority Scoring System**
- **Geo-based Matching (distance filtering)**
- **Firebase-backed real-time database**
- **Live Map Visualization (Google Maps)**
- **Explainable AI Decision Insights**
- **Dual Mode: Disaster (auto assign) / NGO (manual accept)**

---

## 🧠 How It Works

1. **Requester creates task**
2. **Image uploaded → verified using Gemini** (DISASTER mode)
3. **Priority engine calculates severity**
4. **Matching engine selects best volunteers**
5. **Assignments created**
6. **Volunteers accept / track tasks**
7. **Admin monitors dashboard**

---

## 🏗️ Architecture

Frontend:

- React (Firebase Hosting)

Backend:

- FastAPI (Render)

Database:

- Firebase Firestore

AI Layer:

- Google Gemini Vision API

Core Engines:

- Assignment Engine
- Priority Engine
- Vision Pipeline

---

## 🛠️ Tech Stack

- React.js
- FastAPI
- Firebase (Firestore + Hosting)
- Google Gemini API
- Google Maps API
- Python
- TypeScript

---

## 🌐 Live Demo

- **Frontend**: https://sevak-439ee.web.app
- **Backend API**: https://sevak-cursor.onrender.com/

---

## 📸 Screenshots

- Login Page *(placeholder)*
- Dashboard *(placeholder)*
- Map View *(placeholder)*
- Task Creation *(placeholder)*
- Assignment Flow *(placeholder)*

---

## 🔮 Future Scope

1. Offline-first Architecture

   - IndexedDB / local caching
   - Sync when network available

2. Volunteer Tracking (Swiggy-like)

   - Live GPS tracking
   - ETA calculation
   - Route optimization

3. Multi-agent AI System

   - Separate agents for matching, risk, strategy

4. Predictive Analytics

   - Demand forecasting for resources

---

## 💰 Cost Estimation

- Firebase → Free tier
- Gemini API → Free tier
- Render → Free tier

Total MVP Cost: ~0

---

## 📦 Setup Instructions

### Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

---

## 🚀 Deployment

Frontend:

- Firebase Hosting

Backend:

- Render

---

## 📌 Key Highlights

- Fully deployed system (not just prototype)
- AI-integrated decision engine
- Real-time workflow
- Scalable architecture

---

## 🔗 Links

- GitHub Repo: (link)
- Demo Video: (link)
- Live App: (Firebase URL)
- Backend API: (Render URL)
