const API_BASE = "https://sevak-cursor.onrender.com";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "Request failed");
  }
  return res.json();
}

// ── Types ──
export interface Skill {
  id: number;
  name: string;
}

export interface User {
  id: number;
  name: string;
  role: string;
  lat: number;
  lng: number;
  availability: boolean;
  status: string;
  phone: string | null;
  rating: number;
  workload: number;
  skills: Skill[];
}

export interface AuthResponse {
  user: User;
  token: string;
}

export interface Assignment {
  id: number;
  request_id: number;
  volunteer_id: number;
  score: number;
  match_label?: string | null;
  status: string;
  reason: string;
  created_at: string;
  volunteer?: User;
}

export interface Task {
  id: number;
  requester_id: number | null;
  incident_type: string;
  title: string;
  description: string;
  mode: string;
  lat: number;
  lng: number;
  people_count: number;
  status: string;
  priority_score: number;
  priority_level: string;
  priority_explanation?: string | null;
  cluster_boost: number;
  severity_support_points: number;
  supporter_count: number;
  image_url: string | null;
  image_verification_status: string;
  image_verification_reason: string | null;
  ai_insight: string | null;
  created_at: string;
  skills: Skill[];
  assignments: Assignment[];
}

export interface MatchResult {
  volunteer: User;
  score: number;
  match_label?: string | null;
  justification: string;
}

export interface CleanVolunteerDecision {
  id: number;
  name: string;
  fit: string;
  reason: string;
  distance: string;
  tag: string;
}

export interface MatchResponse {
  task_id: number;
  mode: string;
  top_volunteers: MatchResult[];
  clean_volunteers: CleanVolunteerDecision[];
  auto_assigned: boolean;
}

export interface TaskCreateResponse {
  request: Task;
  ai_insight?: string | null;
  priority_explanation?: string | null;
  assigned_count: number;
  suggested_volunteers: Assignment[];
  clean_volunteers: CleanVolunteerDecision[];
  duplicate_detected: boolean;
  duplicate_points_added: number;
  duplicate_request: Task | null;
  verification: {
    is_disaster: boolean | null;
    confidence: number | null;
    labels: string[];
    reason: string;
    warnings: string[];
  } | null;
  match_results: MatchResponse | null;
}

export interface DashboardAnalytics {
  total_tasks: number;
  active_tasks: number;
  completed_tasks: number;
  total_volunteers: number;
  available_volunteers: number;
  disaster_tasks: number;
  ngo_tasks: number;
  critical_tasks: number;
  avg_response_time_min: number;
  completion_rate: number;
  tasks_by_status: Record<string, number>;
  tasks_by_priority: Record<string, number>;
  tasks_by_mode: Record<string, number>;
  ai_insight: string;
  recent_activity: Array<{
    type: string;
    message: string;
    status: string;
    score: number;
    time: string;
  }>;
}

export interface DecisionFlow {
  priority: string;
  required_volunteers: number;
  selection_reason: string;
  ai_insight: string | null;
  clean_volunteers: CleanVolunteerDecision[];
}

export interface HeatmapPoint {
  lat: number;
  lng: number;
  intensity: number;
  label: string;
}

export interface VolunteerPerformance {
  volunteer_id: number;
  name: string;
  tasks_completed: number;
  avg_rating: number;
  availability_rate: number;
  skills: string[];
}

export interface SkillDemand {
  skill: string;
  demand: number;
  supply: number;
  gap: number;
}

export interface Rating {
  id: number;
  assignment_id: number;
  rating: number;
  comment: string | null;
  created_at: string;
}

// ── Auth ──
export const authApi = {
  login: (data: { name: string; role: string; phone?: string; lat?: number; lng?: number; skills?: string[] }) =>
    request<AuthResponse>("/api/auth/login", { method: "POST", body: JSON.stringify(data) }),

  register: (data: { name: string; role: string; phone?: string; lat?: number; lng?: number; skills?: string[] }) =>
    request<AuthResponse>("/api/auth/register", { method: "POST", body: JSON.stringify(data) }),
};

// ── Tasks ──
export const tasksApi = {
  list: (mode?: string, status?: string) => {
    const params = new URLSearchParams();
    if (mode) params.set("mode", mode);
    if (status) params.set("status", status);
    const qs = params.toString();
    return request<Task[]>(`/api/tasks${qs ? `?${qs}` : ""}`);
  },

  get: (id: number) => request<Task>(`/api/tasks/${id}`),

  create: (data: {
    requester_id?: number;
    incident_type: string;
    title: string;
    description: string;
    required_skills: string[];
    people_count: number;
    lat: number;
    lng: number;
    mode: string;
    image_data?: string | null;
  }) => request<TaskCreateResponse>("/api/tasks", { method: "POST", body: JSON.stringify(data) }),

  update: (id: number, data: { title?: string; description?: string; status?: string; priority_level?: string; mode?: string }) =>
    request<Task>(`/api/tasks/${id}`, { method: "PUT", body: JSON.stringify(data) }),

  match: (id: number) => request<MatchResponse>(`/api/tasks/${id}/match`, { method: "POST" }),

  decisionFlow: (id: number) => request<DecisionFlow>(`/api/tasks/${id}/decision-flow`),

  bulkCreate: (tasks: Array<{
    requester_id?: number;
    incident_type: string;
    title: string;
    description: string;
    required_skills: string[];
    people_count: number;
    lat: number;
    lng: number;
    mode: string;
  }>) => request<Task[]>("/api/tasks/bulk", { method: "POST", body: JSON.stringify({ tasks }) }),
};

// ── Volunteers ──
export const volunteersApi = {
  get: (id: number) => request<User>(`/api/volunteers/${id}`),

  update: (id: number, data: { name?: string; phone?: string; lat?: number; lng?: number; availability?: boolean; status?: string }) =>
    request<User>(`/api/volunteers/${id}`, { method: "PUT", body: JSON.stringify(data) }),

  updateLocation: (id: number, data: { lat: number; lng: number }) =>
    request<User>(`/api/volunteers/${id}/location`, { method: "PUT", body: JSON.stringify(data) }),

  updateSkills: (id: number, skills: string[]) =>
    request<User>(`/api/volunteers/${id}/skills`, { method: "POST", body: JSON.stringify({ skills }) }),

  getAssignments: (id: number) =>
    request<Assignment[]>(`/api/volunteers/${id}/assignments`),

  search: (params?: { skill?: string; available?: boolean; lat?: number; lng?: number; radius_km?: number }) => {
    const qs = new URLSearchParams();
    if (params?.skill) qs.set("skill", params.skill);
    if (params?.available !== undefined) qs.set("available", String(params.available));
    if (params?.lat !== undefined) qs.set("lat", String(params.lat));
    if (params?.lng !== undefined) qs.set("lng", String(params.lng));
    if (params?.radius_km !== undefined) qs.set("radius_km", String(params.radius_km));
    const q = qs.toString();
    return request<User[]>(`/api/volunteers/search${q ? `?${q}` : ""}`);
  },
};

// â”€â”€ Users â”€â”€
export const usersApi = {
  updateLocation: (id: number, data: { lat: number; lng: number }) =>
    request<User>(`/api/users/${id}/location`, { method: "PUT", body: JSON.stringify(data) }),
};

// ── Assignments ──
export const assignmentsApi = {
  create: (task_id: number, volunteer_id: number) =>
    request<Assignment>("/api/assignments", { method: "POST", body: JSON.stringify({ task_id, volunteer_id }) }),

  accept: (id: number) =>
    request<Assignment>(`/api/assignments/${id}/accept`, { method: "PUT" }),

  decline: (id: number) =>
    request<Assignment>(`/api/assignments/${id}/decline`, { method: "PUT" }),

  complete: (id: number) =>
    request<Assignment>(`/api/assignments/${id}/complete`, { method: "PUT" }),

  updateStatus: (id: number, status: string) =>
    request<Assignment>(`/api/assignments/${id}/status`, { method: "PUT", body: JSON.stringify({ status }) }),

  rate: (id: number, rating: number, comment?: string) =>
    request<Rating>(`/api/assignments/${id}/rate`, { method: "POST", body: JSON.stringify({ rating, comment }) }),
};

// ── Analytics ──
export const analyticsApi = {
  dashboard: () => request<DashboardAnalytics>("/api/analytics/dashboard"),
  dashboardInsight: () => request<{ insight: string }>("/api/analytics/dashboard/insight"),
  heatmap: () => request<HeatmapPoint[]>("/api/analytics/heatmap"),
  volunteerPerformance: () => request<VolunteerPerformance[]>("/api/analytics/volunteer-performance"),
  skillDemand: () => request<SkillDemand[]>("/api/analytics/skill-demand"),
};

// ── Legacy endpoints ──
export const legacyApi = {
  adminOverview: () => request<{ totals: Record<string, number>; requests: Task[]; volunteers: User[] }>("/admin/overview"),
};
