// Comprehensive mock data for 100+ volunteers
// Location: Bangalore, India area (12.9716° N, 77.5946° E)

export interface Volunteer {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  locationLat: number;
  locationLng: number;
  profession: string;
  yearsOfExperience: number;
  skills: string[];
  skillProficiency: Record<string, number>; // 1-5
  availabilityStatus: 'available' | 'busy' | 'offline';
  maxTasksPerWeek: number;
  currentWorkload: number;
  reliabilityScore: number; // 0-100
  totalTasksCompleted: number;
  averageRating: number; // 1-5
  onboardingCompleted: boolean;
  availabilitySlots: {
    dayOfWeek: number; // 0-6
    startTime: string;
    endTime: string;
  }[];
}

const firstNames = [
  'Aarav', 'Aanya', 'Aaradhya', 'Aarush', 'Abhinav', 'Aditi', 'Advait', 'Advika', 'Ahaan', 'Ahana',
  'Aishwarya', 'Ajay', 'Akash', 'Akshara', 'Akshay', 'Amara', 'Amaya', 'Amit', 'Amrita', 'Ananya',
  'Anay', 'Anika', 'Anirudh', 'Anisha', 'Ankit', 'Anvi', 'Arjun', 'Arnav', 'Aryan', 'Arya',
  'Ashwin', 'Avani', 'Ayaan', 'Ayush', 'Bhavya', 'Chetan', 'Darsh', 'Dev', 'Dhruv', 'Dia',
  'Divya', 'Eesha', 'Ekta', 'Gaurav', 'Gayatri', 'Harsh', 'Harsha', 'Isha', 'Ishaan', 'Jatin',
  'Jay', 'Karthik', 'Kavya', 'Kiran', 'Krish', 'Krishna', 'Kriti', 'Laksh', 'Lakshmi', 'Lavanya',
  'Madhav', 'Madhavi', 'Manish', 'Meera', 'Mohan', 'Mohit', 'Naina', 'Nakul', 'Nandini', 'Neha',
  'Nikhil', 'Nisha', 'Nitin', 'Om', 'Pallavi', 'Parth', 'Pooja', 'Pranav', 'Pranjal', 'Priyanka',
  'Rahul', 'Raj', 'Rakesh', 'Ravi', 'Rekha', 'Rhea', 'Rishi', 'Rohit', 'Roshni', 'Saanvi',
  'Sahil', 'Sakshi', 'Sameer', 'Samar', 'Sandeep', 'Sanjay', 'Sanskriti', 'Sara', 'Sarthak', 'Sathvik'
];

const lastNames = [
  'Sharma', 'Kumar', 'Singh', 'Patel', 'Gupta', 'Reddy', 'Nair', 'Rao', 'Desai', 'Shah',
  'Mehta', 'Iyer', 'Joshi', 'Bhat', 'Kulkarni', 'Agarwal', 'Banerjee', 'Chatterjee', 'Das', 'Ghosh',
  'Malhotra', 'Khanna', 'Kapoor', 'Verma', 'Yadav', 'Chauhan', 'Thakur', 'Pandey', 'Tiwari', 'Mishra',
  'Jain', 'Goel', 'Sethi', 'Bajaj', 'Chopra', 'Srinivasan', 'Venkataraman', 'Subramanian', 'Balasubramanian', 'Ranganathan',
  'Menon', 'Pillai', 'Nambiar', 'Kutty', 'Pai', 'Hegde', 'Gowda', 'Swamy', 'Raju', 'Prasad'
];

const professions = [
  'Doctor', 'Nurse', 'Paramedic', 'Firefighter', 'Police Officer', 'Engineer', 'Teacher', 'Social Worker',
  'Construction Worker', 'Electrician', 'Plumber', 'Carpenter', 'Driver', 'Chef', 'Pharmacist', 'Psychologist',
  'Counselor', 'Translator', 'IT Professional', 'Student', 'Retired Army', 'Retired Police', 'Civil Servant',
  'NGO Worker', 'Journalist', 'Lawyer', 'Accountant', 'Manager', 'Sales Executive', 'Business Owner'
];

const skillsList = [
  'First Aid', 'CPR', 'Medical Triage', 'Fire Rescue', 'Search and Rescue', 'Water Rescue',
  'Crowd Control', 'Traffic Management', 'Debris Removal', 'Shelter Management', 'Food Distribution',
  'Water Supply', 'Electrical Repair', 'Plumbing', 'Carpentry', 'Masonry', 'Driving', 'Heavy Vehicle Operation',
  'Communication', 'Translation', 'Counseling', 'Child Care', 'Elderly Care', 'Animal Rescue',
  'IT Support', 'Data Entry', 'Documentation', 'Photography', 'Drone Operation', 'Navigation'
];

const baseLocation = { lat: 12.9716, lng: 77.5946 }; // Bangalore

function randomInRange(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickMultiple<T>(arr: T[], count: number): T[] {
  const shuffled = [...arr].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

// Generate 120 volunteers
export const volunteers: Volunteer[] = Array.from({ length: 120 }, (_, i) => {
  const firstName = pickRandom(firstNames);
  const lastName = pickRandom(lastNames);
  const profession = pickRandom(professions);
  const numSkills = randomInt(2, 6);
  const volunteerSkills = pickMultiple(skillsList, numSkills);
  
  // Generate skill proficiency (1-5)
  const skillProficiency: Record<string, number> = {};
  volunteerSkills.forEach(skill => {
    skillProficiency[skill] = randomInt(2, 5);
  });

  // Random location within 50km radius
  const angle = randomInRange(0, 2 * Math.PI);
  const distance = randomInRange(0, 0.45); // ~50km in degrees
  const locationLat = baseLocation.lat + distance * Math.cos(angle);
  const locationLng = baseLocation.lng + distance * Math.sin(angle);

  // Availability slots (2-4 days per week)
  const numSlots = randomInt(2, 4);
  const availabilitySlots = pickMultiple([0, 1, 2, 3, 4, 5, 6], numSlots).map(day => ({
    dayOfWeek: day,
    startTime: `${randomInt(6, 10)}:00`,
    endTime: `${randomInt(16, 22)}:00`,
  }));

  // Calculate reliability based on experience and completed tasks
  const yearsOfExperience = randomInt(0, 25);
  const totalTasksCompleted = randomInt(0, 50);
  const reliabilityScore = Math.min(100, 60 + yearsOfExperience * 1.5 + totalTasksCompleted * 0.5 + randomInt(-10, 10));

  return {
    id: `vol-${String(i + 1).padStart(4, '0')}`,
    firstName,
    lastName,
    email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}${randomInt(1, 999)}@email.com`,
    phone: `+91${randomInt(7000000000, 9999999999)}`,
    locationLat: parseFloat(locationLat.toFixed(6)),
    locationLng: parseFloat(locationLng.toFixed(6)),
    profession,
    yearsOfExperience,
    skills: volunteerSkills,
    skillProficiency,
    availabilityStatus: pickRandom(['available', 'available', 'available', 'busy', 'offline']),
    maxTasksPerWeek: randomInt(3, 10),
    currentWorkload: randomInt(0, 5),
    reliabilityScore: Math.round(reliabilityScore),
    totalTasksCompleted,
    averageRating: parseFloat((randomInRange(3.5, 5)).toFixed(1)),
    onboardingCompleted: Math.random() > 0.1, // 90% have completed onboarding
    availabilitySlots,
  };
});

// Helper function to calculate distance between two points (Haversine formula)
export function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Intelligent Assignment Engine
export interface AssignmentScore {
  volunteerId: string;
  volunteer: Volunteer;
  score: number;
  skillMatch: number;
  distanceScore: number;
  availabilityScore: number;
  reliabilityScore: number;
  reasoning: string;
}

export interface TaskRequirements {
  locationLat: number;
  locationLng: number;
  requiredSkills: string[];
  priority: number; // 1-5
  peopleCount: number;
}

export function calculateAssignmentScore(
  volunteer: Volunteer,
  task: TaskRequirements
): AssignmentScore {
  // 1. Skill Match (40%)
  const matchedSkills = task.requiredSkills.filter(skill => 
    volunteer.skills.includes(skill)
  );
  const skillMatch = task.requiredSkills.length > 0
    ? (matchedSkills.length / task.requiredSkills.length) * 100
    : 50;

  // 2. Distance Score (25%) - closer is better
  const distance = calculateDistance(
    volunteer.locationLat,
    volunteer.locationLng,
    task.locationLat,
    task.locationLng
  );
  const distanceScore = Math.max(0, 100 - (distance / 50) * 100); // 50km = 0 score

  // 3. Availability Score (20%)
  let availabilityScore = 0;
  if (volunteer.availabilityStatus === 'available') {
    availabilityScore = 100;
  } else if (volunteer.availabilityStatus === 'busy') {
    availabilityScore = 50;
  } else {
    availabilityScore = 0;
  }
  // Reduce score if workload is high
  const workloadRatio = volunteer.currentWorkload / volunteer.maxTasksPerWeek;
  availabilityScore *= (1 - workloadRatio * 0.5);

  // 4. Reliability Score (15%)
  const reliabilityScore = volunteer.reliabilityScore;

  // Calculate weighted total score
  const score = 
    (skillMatch * 0.40) +
    (distanceScore * 0.25) +
    (availabilityScore * 0.20) +
    (reliabilityScore * 0.15);

  // Generate reasoning
  const reasons: string[] = [];
  if (skillMatch >= 80) reasons.push(`Excellent skill match (${Math.round(skillMatch)}%)`);
  else if (skillMatch >= 50) reasons.push(`Good skill match (${Math.round(skillMatch)}%)`);
  
  if (distance < 5) reasons.push('Very close to location');
  else if (distance < 15) reasons.push('Nearby location');
  
  if (volunteer.availabilityStatus === 'available') reasons.push('Currently available');
  
  if (volunteer.reliabilityScore >= 90) reasons.push('Highly reliable');
  else if (volunteer.reliabilityScore >= 75) reasons.push('Reliable');

  return {
    volunteerId: volunteer.id,
    volunteer,
    score: Math.round(score),
    skillMatch: Math.round(skillMatch),
    distanceScore: Math.round(distanceScore),
    availabilityScore: Math.round(availabilityScore),
    reliabilityScore,
    reasoning: reasons.join(', ') || 'Standard match',
  };
}

export function findBestVolunteers(
  task: TaskRequirements,
  availableVolunteers: Volunteer[] = volunteers
): AssignmentScore[] {
  // Filter out unavailable and overloaded volunteers
  const eligibleVolunteers = availableVolunteers.filter(v => 
    v.availabilityStatus !== 'offline' &&
    v.currentWorkload < v.maxTasksPerWeek &&
    v.onboardingCompleted
  );

  // Calculate scores for all eligible volunteers
  const scoredVolunteers = eligibleVolunteers.map(v => 
    calculateAssignmentScore(v, task)
  );

  // Sort by score descending
  return scoredVolunteers.sort((a, b) => b.score - a.score);
}

export function assignVolunteersToTask(
  task: TaskRequirements,
  availableVolunteers?: Volunteer[]
): AssignmentScore[] {
  const scoredVolunteers = findBestVolunteers(task, availableVolunteers);
  
  // Determine number of volunteers based on priority
  let numVolunteers = 1;
  if (task.priority === 2) numVolunteers = 2;
  else if (task.priority === 3) numVolunteers = 3;
  else if (task.priority === 4) numVolunteers = 4;
  else if (task.priority === 5) numVolunteers = Math.max(6, task.peopleCount);

  // Also consider people_count
  numVolunteers = Math.max(numVolunteers, Math.ceil(task.peopleCount / 5));

  return scoredVolunteers.slice(0, numVolunteers);
}

// Export statistics
export const volunteerStats = {
  total: volunteers.length,
  available: volunteers.filter(v => v.availabilityStatus === 'available').length,
  busy: volunteers.filter(v => v.availabilityStatus === 'busy').length,
  offline: volunteers.filter(v => v.availabilityStatus === 'offline').length,
  byProfession: professions.reduce((acc, prof) => {
    acc[prof] = volunteers.filter(v => v.profession === prof).length;
    return acc;
  }, {} as Record<string, number>),
  bySkill: skillsList.reduce((acc, skill) => {
    acc[skill] = volunteers.filter(v => v.skills.includes(skill)).length;
    return acc;
  }, {} as Record<string, number>),
};
