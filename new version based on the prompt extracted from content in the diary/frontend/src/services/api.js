import axios from "axios";

const baseURL = String(import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000").trim();

const api = axios.create({
  baseURL,
});

export const login = async (payload) => (await api.post("/login", payload)).data;
export const fetchRequests = async () => (await api.get("/requests")).data;
export const createRequest = async (payload) => (await api.post("/requests", payload)).data;
export const fetchVolunteerTasks = async (volunteerId) => (await api.get(`/volunteer/${volunteerId}/tasks`)).data;
export const fetchNearbyVolunteerRequests = async (volunteerId) => (await api.get(`/volunteer/${volunteerId}/nearby-requests`)).data;
export const fetchNearbyRequesterRequests = async (requesterId) => (await api.get(`/requester/${requesterId}/nearby-requests`)).data;
export const updateAssignment = async (assignmentId, status) =>
  (await api.put(`/assignments/${assignmentId}`, { status })).data;
export const updateVolunteerStatus = async (volunteerId, payload) =>
  (await api.put(`/volunteer/${volunteerId}/status`, payload)).data;
export const updateVolunteerLocation = async (volunteerId, payload) =>
  (await api.put(`/volunteer/${volunteerId}/location`, payload)).data;
export const updateRequesterLocation = async (requesterId, payload) =>
  (await api.put(`/requester/${requesterId}/location`, payload)).data;
export const claimRequest = async (requestId, volunteerId) =>
  (await api.post(`/requests/${requestId}/claim`, { volunteer_id: volunteerId })).data;
export const supportRequest = async (requestId, requesterId, points = 10) =>
  (await api.post(`/requests/${requestId}/support`, { requester_id: requesterId, points })).data;
export const resolveRequest = async (requestId, requesterId) =>
  (await api.put(`/requests/${requestId}/resolve`, { requester_id: requesterId })).data;
export const fetchAdminOverview = async () => (await api.get("/admin/overview")).data;

export default api;
