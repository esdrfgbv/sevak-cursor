"""
Firebase demo data seeder for SEVAK.
Creates realistic demo data within 20km radius of Hyderabad.
"""
from __future__ import annotations

import random
from datetime import datetime, timedelta

from . import firebase_service
from .. import config

# ── Demo Data Templates ──────────────────────────────────────────────────────

SKILL_POOL = [
    "Medical", "Search and Rescue", "Swift Water Rescue", "Logistics",
    "Electrical", "Firefighting", "Paramedic", "Structural Rescue",
    "Shelter Management", "Communications", "First Aid", "CPR",
    "Crowd Control", "Food Distribution", "Counseling", "Translation",
]

FIRST_NAMES = [
    "Aarav", "Aditi", "Ananya", "Arjun", "Deepa", "Dhruv", "Farah", "Gautham",
    "Harini", "Imran", "Ishita", "Jagan", "Kavya", "Keerthi", "Lakshmi", "Manoj",
    "Meera", "Nikhil", "Nisha", "Omar", "Pooja", "Rahul", "Riya", "Sanjay",
    "Sneha", "Suresh", "Varun", "Vidya", "Vikram", "Yamini",
]

LAST_NAMES = [
    "Iyer", "Menon", "Reddy", "Nair", "Pillai", "Rao", "Kapoor", "Das",
    "Sen", "Bose", "Choudhury", "Kulkarni", "Patel", "Shah", "Thomas",
    "George", "Fernandes", "Khanna", "Verma", "Krishnan",
]

DISASTER_TEMPLATES = [
    ("Medical Emergency", "Street medical triage needed", "Casualties reported near a busy junction; crowd control and medical triage required."),
    ("Flood Rescue", "Waterlogged lane with families stranded", "Waist-deep water in a residential pocket; elderly residents need evacuation support."),
    ("Structural Collapse", "Wall breach in commercial block", "Partial collapse after heavy rain; debris field may have trapped workers."),
    ("Power Failure", "Substation hazard and outage", "Transformer fault with exposed cabling; isolation and logistics for shelters required."),
    ("Urban Fire", "Smoke in multi-storey housing", "Smoke billowing from mid floors; possible trapped residents reported by neighbors."),
    ("Flood Rescue", "Canal overflow near slum lanes", "Fast rising water from canal breach; swift-water capable teams requested."),
]

NGO_TEMPLATES = [
    ("Supply Distribution", "Relief supply distribution point", "Distribution of food, water, and clothing at community center."),
    ("Shelter Management", "Temporary shelter setup needed", "Setting up and managing a temporary shelter for 200 displaced families."),
    ("Community Health", "Health camp organization", "Organizing a health check-up camp for flood-affected communities."),
    ("Food Distribution", "Community kitchen management", "Running community kitchen serving 500+ meals daily at relief camp."),
    ("Water Supply", "Water purification and distribution", "Setting up water purification units and distribution at affected areas."),
]


def seed_firebase_demo_data():
    """
    Create 50 volunteers + 20 requests + skills within 20km radius.
    Only runs if Firestore is empty.
    """
    # Check if data already exists
    existing_users = list(firebase_service.db.collection('users').limit(1).stream())
    if existing_users:
        print("✓ Firebase demo data already exists. Skipping seed.")
        return
    
    print("🌱 Seeding Firebase demo data...")
    rng = random.Random(42)  # Fixed seed for reproducibility
    
    try:
        # ── Step 1: Create Skills ──
        print("  Creating skills...")
        skill_ids = []
        for skill_name in SKILL_POOL:
            skill = firebase_service.get_or_create_skill(skill_name)
            skill_ids.append(skill['id'])
        print(f"  ✓ Created {len(SKILL_POOL)} skills")
        
        # ── Step 2: Create Staff Accounts ──
        print("  Creating staff accounts...")
        staff_data = [
            {
                'name': 'Field Officer',
                'role': 'requester',
                'lat': config.BASE_LAT,
                'lng': config.BASE_LNG,
                'availability': False,
                'status': 'available',
                'phone': '+91-requester-01',
                'skills': [],
                'rating': 0.0,
                'workload': 0
            },
            {
                'name': 'Command Admin',
                'role': 'admin',
                'lat': config.BASE_LAT,
                'lng': config.BASE_LNG,
                'availability': False,
                'status': 'available',
                'phone': '+91-admin-01',
                'skills': [],
                'rating': 0.0,
                'workload': 0
            },
            {
                'name': 'NGO Coordinator',
                'role': 'requester',
                'lat': config.BASE_LAT + 0.01,
                'lng': config.BASE_LNG + 0.01,
                'availability': False,
                'status': 'available',
                'phone': '+91-ngo-01',
                'skills': [],
                'rating': 0.0,
                'workload': 0
            }
        ]
        
        staff_users = []
        for staff in staff_data:
            user = firebase_service.create_user(staff)
            staff_users.append(user)
            print(f"    ✓ {staff['name']} (ID: {user['id'][:8]}...)")
        
        # ── Step 3: Create 50 Volunteers ──
        print("  Creating 50 volunteers...")
        volunteers = []
        
        for i in range(50):
            lat, lng = firebase_service.generate_nearby_location()
            fname = rng.choice(FIRST_NAMES)
            lname = rng.choice(LAST_NAMES)
            
            # 85% available, 15% busy
            is_available = rng.random() < 0.85
            status = 'available' if is_available else rng.choice(['assigned', 'en_route'])
            
            volunteer_data = {
                'name': f"{fname} {lname}",
                'role': 'volunteer',
                'lat': lat,
                'lng': lng,
                'availability': is_available,
                'status': status,
                'phone': f"+91-{rng.randint(7000000000, 9999999999)}",
                'rating': round(rng.uniform(3.0, 5.0), 2),
                'workload': rng.randint(0, 3),
                'skills': rng.sample(SKILL_POOL, rng.randint(1, 4))
            }
            
            user = firebase_service.create_user(volunteer_data)
            volunteers.append(user)
        
        print(f"  ✓ Created {len(volunteers)} volunteers within {config.DEMO_RADIUS_KM}km radius")
        
        # ── Step 4: Create 20 Requests (12 DISASTER + 8 NGO) ──
        print("  Creating 20 requests...")
        now = datetime.utcnow()
        
        # Get requester ID
        requester_id = staff_users[0]['id']  # Field Officer
        ngo_requester_id = staff_users[2]['id']  # NGO Coordinator
        
        # 12 DISASTER requests
        for i in range(12):
            lat, lng = firebase_service.generate_nearby_location()
            incident_type, title, desc = rng.choice(DISASTER_TEMPLATES)
            
            # Calculate priority
            priority_score = rng.randint(50, 100)
            if priority_score >= 88:
                priority_level = "CRITICAL"
            elif priority_score >= 75:
                priority_level = "HIGH"
            elif priority_score >= 50:
                priority_level = "MEDIUM"
            else:
                priority_level = "LOW"
            
            request_data = {
                'requester_id': requester_id,
                'incident_type': incident_type,
                'title': f"{title} (D-{i+1})",
                'description': desc,
                'mode': 'DISASTER',
                'lat': lat,
                'lng': lng,
                'people_count': rng.randint(5, 50),
                'status': rng.choice(['pending', 'pending', 'assigned']),  # More pending for demo
                'priority_score': priority_score,
                'priority_level': priority_level,
                'cluster_boost': rng.randint(0, 10),
                'severity_support_points': 0,
                'image_url': None,
                'image_verification_status': 'not_submitted',
                'image_verification_reason': 'Seeded demo request',
                'ai_insight': None,
                'required_skills': rng.sample(SKILL_POOL, rng.randint(1, 3)),
                'created_at': now - timedelta(hours=rng.randint(0, 48))
            }
            
            firebase_service.create_request(request_data)
        
        # 8 NGO requests
        for i in range(8):
            lat, lng = firebase_service.generate_nearby_location()
            incident_type, title, desc = rng.choice(NGO_TEMPLATES)
            
            priority_score = rng.randint(30, 80)
            if priority_score >= 75:
                priority_level = "HIGH"
            elif priority_score >= 50:
                priority_level = "MEDIUM"
            else:
                priority_level = "LOW"
            
            request_data = {
                'requester_id': ngo_requester_id,
                'incident_type': incident_type,
                'title': f"{title} (N-{i+1})",
                'description': desc,
                'mode': 'NGO',
                'lat': lat,
                'lng': lng,
                'people_count': rng.randint(10, 100),
                'status': rng.choice(['pending', 'pending', 'assigned']),
                'priority_score': priority_score,
                'priority_level': priority_level,
                'cluster_boost': 0,
                'severity_support_points': 0,
                'image_url': None,
                'image_verification_status': 'not_required',
                'image_verification_reason': 'NGO mode - image not required',
                'ai_insight': None,
                'required_skills': rng.sample(SKILL_POOL, rng.randint(1, 3)),
                'created_at': now - timedelta(hours=rng.randint(0, 72))
            }
            
            firebase_service.create_request(request_data)
        
        print(f"  ✓ Created 20 requests (12 DISASTER + 8 NGO)")
        
        # ── Summary ──
        print("\n🎉 Firebase demo data seeded successfully!")
        print(f"  📍 All data within {config.DEMO_RADIUS_KM}km of Hyderabad ({config.BASE_LAT}, {config.BASE_LNG})")
        print(f"  👥 {len(volunteers)} volunteers created")
        print(f"  📋 20 requests created")
        print(f"  🎯 {len(SKILL_POOL)} skills created")
        print(f"  👨‍💼 3 staff accounts created")
        
    except Exception as e:
        print(f"\n❌ Error seeding demo data: {e}")
        raise
