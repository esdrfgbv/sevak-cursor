# 🚀 SEVAK Deployment Checklist

Use this checklist to track your deployment progress.

---

## Pre-Deployment Setup

### Accounts & API Keys
- [ ] GitHub account created
- [ ] Firebase account created
- [ ] Render account created
- [ ] Google Gemini API key obtained
- [ ] Firebase project created (`sevak-disasteriq`)
- [ ] Firestore database enabled
- [ ] Firebase service account key downloaded

### Local Setup
- [ ] Node.js 20+ installed
- [ ] Python 3.13+ installed
- [ ] Firebase CLI installed (`npm install -g firebase-tools`)
- [ ] Git installed and configured

---

## Backend Deployment (Render)

### Code Preparation
- [ ] All code committed to Git
- [ ] Repository pushed to GitHub
- [ ] `backend/requirements.txt` exists
- [ ] `backend/runtime.txt` exists (Python 3.13.2)
- [ ] `backend/main.py` is entry point

### Render Setup
- [ ] Web service created on Render
- [ ] GitHub repository connected
- [ ] Root Directory set to: `backend`
- [ ] Build Command: `pip install -r requirements.txt`
- [ ] Start Command: `uvicorn main:app --host 0.0.0.0 --port $PORT`

### Environment Variables (Add to Render)
- [ ] `FIREBASE_PROJECT_ID=sevak-disasteriq`
- [ ] `FIREBASE_CREDENTIALS_PATH=./firebase-credentials.json`
- [ ] `GEMINI_API_KEY=AIza...` (your key)
- [ ] `GEMINI_VISION_MODEL=gemini-1.5-flash`
- [ ] `BASE_LAT=17.3850`
- [ ] `BASE_LNG=78.4867`
- [ ] `DEMO_RADIUS_KM=20`
- [ ] `MAX_ASSIGNMENT_DISTANCE_KM=50`

### Secret Files
- [ ] `firebase-credentials.json` uploaded as Secret File in Render
- [ ] File name exactly: `firebase-credentials.json`
- [ ] JSON content is complete and valid

### Deployment
- [ ] Backend deployed successfully
- [ ] No errors in Render logs
- [ ] Health endpoint responds: `https://your-backend.onrender.com/`
- [ ] API docs accessible: `https://your-backend.onrender.com/docs`
- [ ] Volunteers endpoint works: `https://your-backend.onrender.com/volunteers`

### Verification
- [ ] Health check returns Firebase project info
- [ ] Firestore collections created (users, requests, skills)
- [ ] 50 volunteers seeded
- [ ] 20 requests seeded
- [ ] Demo data within 20km radius

---

## Frontend Deployment (Firebase)

### Preparation
- [ ] Backend URL obtained from Render
- [ ] `frontend/.env.production` created
- [ ] `VITE_API_URL` set to Render backend URL
- [ ] All dependencies installed: `npm install`

### Build
- [ ] Frontend builds without errors: `npm run build`
- [ ] `dist/` folder created
- [ ] No TypeScript errors
- [ ] No missing dependencies

### Firebase Hosting Setup
- [ ] Firebase CLI installed
- [ ] Logged in to Firebase: `firebase login`
- [ ] Firebase initialized: `firebase init hosting`
- [ ] Project selected: `sevak-disasteriq`
- [ ] Public directory: `dist`
- [ ] Single-page app: Yes
- [ ] `firebase.json` exists and configured

### Deployment
- [ ] Frontend deployed: `firebase deploy --only hosting`
- [ ] Deployment successful
- [ ] Hosting URL obtained: `https://your-project.web.app`

### Verification
- [ ] Frontend loads in browser
- [ ] Can login to application
- [ ] Can create requests
- [ ] Can view volunteers on map
- [ ] All volunteers within 20km
- [ ] API calls reach backend successfully
- [ ] No CORS errors in console

---

## Post-Deployment Testing

### Core Features
- [ ] User registration/login works
- [ ] Can create disaster request
- [ ] Image upload and verification works
- [ ] Volunteers are auto-assigned
- [ ] Assigned volunteers within 50km
- [ ] Map shows all markers correctly
- [ ] Dashboard displays statistics
- [ ] Analytics page loads

### Edge Cases
- [ ] Creating request without image
- [ ] Creating request far from base location
- [ ] Viewing requests with no volunteers nearby
- [ ] Mobile responsive design
- [ ] Browser refresh maintains state

### Performance
- [ ] Frontend loads in <3 seconds
- [ ] Backend responds in <2 seconds
- [ ] Map renders smoothly
- [ ] No memory leaks
- [ ] No console errors

---

## Security Checklist

### Firebase Security
- [ ] Firestore security rules configured
- [ ] Not using test mode in production
- [ ] API keys restricted (if applicable)
- [ ] Service account key is secret (not in Git)

### Backend Security
- [ ] CORS configured for frontend domain only
- [ ] Environment variables not hardcoded
- [ ] No secrets in source code
- [ ] Firebase credentials secure

### Frontend Security
- [ ] No API keys exposed in client code
- [ ] Environment variables properly scoped (VITE_ prefix)
- [ ] HTTPS enabled (Firebase does this automatically)

---

## Monitoring & Maintenance

### Setup Monitoring
- [ ] Render logs monitored
- [ ] Firebase hosting analytics enabled
- [ ] Firestore usage monitored
- [ ] Error tracking setup (optional)

### Documentation
- [ ] README.md updated
- [ ] DEPLOYMENT.md followed
- [ ] API documentation accessible
- [ ] Team knows how to deploy updates

### Backup Plan
- [ ] Database export procedure documented
- [ ] Rollback procedure known
- [ ] Emergency contacts available

---

## Optional Enhancements

### Performance
- [ ] CDN enabled (Firebase does this)
- [ ] Image optimization
- [ ] Code splitting
- [ ] Lazy loading

### Features
- [ ] Custom domain configured
- [ ] Email notifications
- [ ] Push notifications
- [ ] Advanced analytics
- [ ] User authentication (Firebase Auth)

### Scaling
- [ ] Render upgraded to paid plan (if needed)
- [ ] Firestore indexes optimized
- [ ] Caching implemented
- [ ] Load balancing configured

---

## Deployment URLs

Fill in your URLs once deployed:

- **Frontend**: https://____________________.web.app
- **Backend**: https://____________________.onrender.com
- **API Docs**: https://____________________.onrender.com/docs
- **Firebase Console**: https://console.firebase.google.com/project/sevak-disasteriq
- **Render Dashboard**: https://dashboard.render.com

---

## Troubleshooting Notes

Document any issues and solutions here:

### Issue 1:
- **Problem**: 
- **Solution**: 

### Issue 2:
- **Problem**: 
- **Solution**: 

---

## Sign-Off

- [ ] All critical features working
- [ ] No major bugs found
- [ ] Performance acceptable
- [ ] Security reviewed
- [ ] Documentation complete
- [ ] Ready for users!

**Deployment Date**: ________________
**Deployed By**: ________________
**Notes**: ________________

---

## Quick Reference Commands

```bash
# Deploy backend (push to GitHub)
git add .
git commit -m "Update"
git push origin main

# Deploy frontend
cd frontend
npm run build
firebase deploy --only hosting

# Check backend logs
# Go to Render dashboard → your service → Logs

# Check Firebase hosting
firebase hosting:channel:list
```

---

**Congratulations on deploying SEVAK! 🎉**

For detailed instructions, see DEPLOYMENT.md
