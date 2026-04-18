export type UserRole = 'admin' | 'coordinator' | 'volunteer';

const tokenKey = 'sevak_access_token';
const userKey = 'sevak_user';

export function getAccessToken() {
  return localStorage.getItem(tokenKey);
}

export function setSession(accessToken: string, user: { id: string; email: string; role: UserRole }) {
  localStorage.setItem(tokenKey, accessToken);
  localStorage.setItem(userKey, JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem(tokenKey);
  localStorage.removeItem(userKey);
}

export function getUser(): { id: string; email: string; role: UserRole } | null {
  const raw = localStorage.getItem(userKey);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getAccessToken();
  const res = await fetch(path, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      'content-type': init?.body ? 'application/json' : (init?.headers as any)?.['content-type'],
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const msg = body?.message ?? `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return (await res.json()) as T;
}

export const api = {
  auth: {
    async login(email: string, password: string) {
      return apiFetch<{ access_token: string; refresh_token: string; user: any }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
    },
    async register(input: { email: string; password: string; phone?: string; role: UserRole; first_name?: string; last_name?: string }) {
      return apiFetch<{ access_token: string; refresh_token: string; user: any }>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(input),
      });
    },
  },
  tasks: {
    list(params?: { status?: string; event_id?: string }) {
      const qs = new URLSearchParams();
      if (params?.status) qs.set('status', params.status);
      if (params?.event_id) qs.set('event_id', params.event_id);
      return apiFetch<any[]>(`/api/tasks?${qs.toString()}`);
    },
    get(id: string) {
      return apiFetch<any>(`/api/tasks/${id}`);
    },
    create(body: any) {
      return apiFetch<any>('/api/tasks', { method: 'POST', body: JSON.stringify(body) });
    },
    match(id: string, limit = 3) {
      return apiFetch<any[]>(`/api/tasks/${id}/match`, { method: 'POST', body: JSON.stringify({ limit }) });
    },
  },
  volunteers: {
    search(q?: string, skill?: string) {
      const qs = new URLSearchParams();
      if (q) qs.set('q', q);
      if (skill) qs.set('skill', skill);
      return apiFetch<any[]>(`/api/volunteers/search?${qs.toString()}`);
    },
    get(id: string) {
      return apiFetch<any>(`/api/volunteers/${id}`);
    },
  },
  assignments: {
    create(body: any) {
      return apiFetch<any>('/api/assignments', { method: 'POST', body: JSON.stringify(body) });
    },
    list(params?: { status?: string }) {
      const qs = new URLSearchParams();
      if (params?.status) qs.set('status', params.status);
      return apiFetch<any[]>(`/api/assignments?${qs.toString()}`);
    },
    accept(id: string) {
      return apiFetch<any>(`/api/assignments/${id}/accept`, { method: 'PUT' });
    },
    decline(id: string) {
      return apiFetch<any>(`/api/assignments/${id}/decline`, { method: 'PUT' });
    },
    complete(id: string, notes?: string) {
      return apiFetch<any>(`/api/assignments/${id}/complete`, { method: 'PUT', body: JSON.stringify({ notes }) });
    },
  },
  analytics: {
    dashboard(eventId?: string) {
      const qs = new URLSearchParams();
      if (eventId) qs.set('event_id', eventId);
      return apiFetch<any>(`/api/analytics/dashboard?${qs.toString()}`);
    },
    heatmap(eventId?: string) {
      const qs = new URLSearchParams();
      if (eventId) qs.set('event_id', eventId);
      return apiFetch<any[]>(`/api/analytics/heatmap?${qs.toString()}`);
    },
    volunteerPerformance(eventId?: string) {
      const qs = new URLSearchParams();
      if (eventId) qs.set('event_id', eventId);
      return apiFetch<any[]>(`/api/analytics/volunteer-performance?${qs.toString()}`);
    },
    skillDemand(eventId?: string) {
      const qs = new URLSearchParams();
      if (eventId) qs.set('event_id', eventId);
      return apiFetch<any[]>(`/api/analytics/skill-demand?${qs.toString()}`);
    },
  },
};

