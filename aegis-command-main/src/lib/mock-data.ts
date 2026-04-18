export type Priority = "critical" | "high" | "medium" | "low";
export type TaskStatus = "open" | "assigned" | "in_progress" | "completed";
export type Availability = "online" | "busy" | "offline";

export interface Task {
  id: string;
  title: string;
  category: string;
  priority: Priority;
  location: string;
  coords: { x: number; y: number }; // % positions for our SVG map
  status: TaskStatus;
  matched: number;
  skills: string[];
  createdAt: string;
  eta: string;
}

export interface Volunteer {
  id: string;
  name: string;
  initials: string;
  skills: string[];
  rating: number;
  distanceKm: number;
  workload: number; // 0-100
  availability: Availability;
  reliability: number; // 0-100
  tasksCompleted: number;
  city: string;
  coords: { x: number; y: number };
}

export const tasks: Task[] = [
  { id: "T-2041", title: "Medical triage at evacuation point Bravo", category: "Medical", priority: "critical", location: "Sector 4 · Riverside", coords: { x: 32, y: 44 }, status: "open", matched: 7, skills: ["First Aid", "Triage", "Spanish"], createdAt: "2 min ago", eta: "12 min" },
  { id: "T-2040", title: "Distribute 400 emergency water rations", category: "Logistics", priority: "high", location: "Shelter 2 · Northbank", coords: { x: 58, y: 28 }, status: "assigned", matched: 12, skills: ["Logistics", "Driving"], createdAt: "8 min ago", eta: "32 min" },
  { id: "T-2039", title: "Translate intake forms (Mandarin)", category: "Translation", priority: "medium", location: "Community Hall", coords: { x: 70, y: 60 }, status: "in_progress", matched: 4, skills: ["Mandarin", "Documentation"], createdAt: "21 min ago", eta: "1h 10m" },
  { id: "T-2038", title: "Search & rescue — collapsed structure", category: "Rescue", priority: "critical", location: "Block 17 · Old Town", coords: { x: 22, y: 72 }, status: "in_progress", matched: 9, skills: ["SAR", "Climbing", "K9"], createdAt: "34 min ago", eta: "2h 15m" },
  { id: "T-2037", title: "Set up overnight shelter cots ×120", category: "Shelter", priority: "high", location: "Civic Center", coords: { x: 48, y: 52 }, status: "open", matched: 5, skills: ["Construction", "Logistics"], createdAt: "44 min ago", eta: "45 min" },
  { id: "T-2036", title: "Mental health check-ins for families", category: "Counseling", priority: "medium", location: "Shelter 4", coords: { x: 64, y: 38 }, status: "assigned", matched: 3, skills: ["Counseling", "Empathy"], createdAt: "1h ago", eta: "ongoing" },
  { id: "T-2035", title: "Childcare during medical screenings", category: "Childcare", priority: "low", location: "Shelter 1", coords: { x: 40, y: 30 }, status: "completed", matched: 6, skills: ["Childcare"], createdAt: "2h ago", eta: "done" },
  { id: "T-2034", title: "Power generator setup — Shelter 3", category: "Utilities", priority: "high", location: "Shelter 3 · Westside", coords: { x: 18, y: 36 }, status: "in_progress", matched: 2, skills: ["Electrical", "Mechanical"], createdAt: "2h ago", eta: "1h" },
];

export const volunteers: Volunteer[] = [
  { id: "V-1024", name: "Amelia Hart", initials: "AH", skills: ["First Aid", "Triage", "Spanish"], rating: 4.9, distanceKm: 1.2, workload: 35, availability: "online", reliability: 98, tasksCompleted: 142, city: "Riverside", coords: { x: 30, y: 42 } },
  { id: "V-1025", name: "Marcus Chen", initials: "MC", skills: ["SAR", "Climbing", "K9"], rating: 4.8, distanceKm: 2.4, workload: 60, availability: "busy", reliability: 95, tasksCompleted: 98, city: "Old Town", coords: { x: 24, y: 70 } },
  { id: "V-1026", name: "Priya Raman", initials: "PR", skills: ["Mandarin", "Translation", "Documentation"], rating: 4.7, distanceKm: 3.8, workload: 20, availability: "online", reliability: 92, tasksCompleted: 64, city: "Community Hall", coords: { x: 68, y: 58 } },
  { id: "V-1027", name: "Diego Alvarez", initials: "DA", skills: ["Logistics", "Driving", "Spanish"], rating: 4.6, distanceKm: 0.9, workload: 75, availability: "busy", reliability: 89, tasksCompleted: 211, city: "Northbank", coords: { x: 56, y: 30 } },
  { id: "V-1028", name: "Sofia Lindqvist", initials: "SL", skills: ["Counseling", "First Aid"], rating: 4.9, distanceKm: 4.5, workload: 15, availability: "online", reliability: 97, tasksCompleted: 73, city: "Shelter 4", coords: { x: 64, y: 36 } },
  { id: "V-1029", name: "Jamal Okafor", initials: "JO", skills: ["Electrical", "Mechanical"], rating: 4.5, distanceKm: 5.1, workload: 45, availability: "online", reliability: 90, tasksCompleted: 56, city: "Westside", coords: { x: 20, y: 38 } },
  { id: "V-1030", name: "Hana Yamada", initials: "HY", skills: ["Childcare", "Counseling"], rating: 4.8, distanceKm: 2.0, workload: 10, availability: "offline", reliability: 94, tasksCompleted: 88, city: "Shelter 1", coords: { x: 42, y: 32 } },
  { id: "V-1031", name: "Liam O'Connor", initials: "LO", skills: ["Construction", "Logistics"], rating: 4.4, distanceKm: 3.2, workload: 55, availability: "online", reliability: 87, tasksCompleted: 120, city: "Civic Center", coords: { x: 50, y: 52 } },
];

export const activityFeed = [
  { id: 1, type: "assign", text: "Amelia Hart assigned to T-2041 · Medical triage", meta: "AI match 96%", time: "just now", tone: "primary" as const },
  { id: 2, type: "alert", text: "Critical alert raised in Sector 4 — Riverside flooding", meta: "auto-escalated", time: "1 min ago", tone: "danger" as const },
  { id: 3, type: "complete", text: "T-2035 Childcare completed by Hana Yamada", meta: "+1 reliability", time: "4 min ago", tone: "success" as const },
  { id: 4, type: "join", text: "12 new volunteers joined from Northbank zone", meta: "auto-verified", time: "7 min ago", tone: "muted" as const },
  { id: 5, type: "assign", text: "Diego Alvarez assigned to T-2040 · Water rations", meta: "AI match 91%", time: "9 min ago", tone: "primary" as const },
  { id: 6, type: "alert", text: "Medical volunteers shortage detected in Sector 4", meta: "predictive insight", time: "12 min ago", tone: "warning" as const },
  { id: 7, type: "complete", text: "T-2032 Generator repair completed at Shelter 2", meta: "on-time", time: "18 min ago", tone: "success" as const },
];

export const completionTrend = [
  { day: "Mon", completed: 64, opened: 72 },
  { day: "Tue", completed: 78, opened: 81 },
  { day: "Wed", completed: 92, opened: 88 },
  { day: "Thu", completed: 110, opened: 124 },
  { day: "Fri", completed: 138, opened: 145 },
  { day: "Sat", completed: 162, opened: 158 },
  { day: "Sun", completed: 184, opened: 176 },
];

export const responseTimeData = [
  { hour: "00", min: 18 }, { hour: "03", min: 22 }, { hour: "06", min: 14 },
  { hour: "09", min: 9 }, { hour: "12", min: 11 }, { hour: "15", min: 8 },
  { hour: "18", min: 12 }, { hour: "21", min: 16 },
];

export const skillDemand = [
  { skill: "Medical", demand: 92, supply: 54 },
  { skill: "Logistics", demand: 78, supply: 81 },
  { skill: "SAR", demand: 65, supply: 38 },
  { skill: "Translation", demand: 48, supply: 52 },
  { skill: "Counseling", demand: 56, supply: 44 },
  { skill: "Electrical", demand: 41, supply: 36 },
];

export const priorityColor: Record<Priority, string> = {
  critical: "bg-danger/10 text-danger ring-danger/30",
  high: "bg-warning/10 text-warning ring-warning/30",
  medium: "bg-primary/10 text-primary ring-primary/20",
  low: "bg-muted text-muted-foreground ring-border",
};

export const statusColor: Record<TaskStatus, string> = {
  open: "bg-warning/10 text-warning",
  assigned: "bg-primary/10 text-primary",
  in_progress: "bg-primary-glow/10 text-primary",
  completed: "bg-success/10 text-success",
};

export const availabilityColor: Record<Availability, string> = {
  online: "bg-success",
  busy: "bg-warning",
  offline: "bg-muted-foreground/40",
};
