import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import MapView from "../components/MapView";
import RequestCard from "../components/RequestCard";
import RequestForm from "../components/RequestForm";
import {
  createRequest,
  fetchAdminOverview,
  fetchNearbyRequesterRequests,
  fetchRequests,
  resolveRequest,
  supportRequest,
  updateRequesterLocation,
} from "../services/api";

export default function RequesterDashboard({ user, onUserChange, onSwitchRole, onLogout }) {
  const [requests, setRequests] = useState([]);
  const [volunteers, setVolunteers] = useState([]);
  const [nearbyRequests, setNearbyRequests] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [supportingId, setSupportingId] = useState(null);
  const [resolvingId, setResolvingId] = useState(null);
  const [duplicateNotice, setDuplicateNotice] = useState(null);
  const [verificationNotice, setVerificationNotice] = useState(null);
  const [rescuedMenuOpen, setRescuedMenuOpen] = useState(false);

  const load = async () => {
    const [requestData, overview, nearbyData] = await Promise.all([
      fetchRequests(),
      fetchAdminOverview(),
      fetchNearbyRequesterRequests(user.id),
    ]);
    setRequests(requestData);
    setVolunteers(overview.volunteers);
    setNearbyRequests(nearbyData);
  };

  useEffect(() => {
    load();
    const timer = setInterval(load, 8000);
    return () => clearInterval(timer);
  }, [user.id]);

  const handleSubmit = async (payload) => {
    setSubmitting(true);
    setDuplicateNotice(null);
    setVerificationNotice(null);
    setSubmitError("");
    try {
      const response = await createRequest(payload);
      if (response.verification) {
        setVerificationNotice(response.verification);
      }
      if (response.duplicate_detected && response.duplicate_request) {
        setDuplicateNotice({
          pointsAdded: response.duplicate_points_added,
          title: response.duplicate_request.title,
          score: response.duplicate_request.priority_score,
        });
      }
      await load();
    } catch (error) {
      const message =
        error?.response?.data?.detail ||
        error?.message ||
        "Request could not be saved. Please confirm the backend is running and try again.";
      setSubmitError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleLocationSync = async (location) => {
    const nextUser = await updateRequesterLocation(user.id, location);
    onUserChange?.(nextUser);
    setDuplicateNotice(null);
    setVerificationNotice(null);
    await load();
  };

  const handleSupport = async (requestId) => {
    setSupportingId(requestId);
    try {
      await supportRequest(requestId, user.id, 10);
      await load();
    } finally {
      setSupportingId(null);
    }
  };

  const handleResolve = async (requestId) => {
    setResolvingId(requestId);
    try {
      await resolveRequest(requestId, user.id);
      await load();
    } finally {
      setResolvingId(null);
    }
  };

  const myRequests = useMemo(() => requests.filter((request) => request.requester_id === user.id), [requests, user.id]);
  const rescuedRequests = useMemo(() => myRequests.filter((request) => request.status === "completed"), [myRequests]);
  const activeMyRequests = useMemo(() => myRequests.filter((request) => request.status !== "completed"), [myRequests]);
  const liveTrackedRequests = useMemo(
    () =>
      activeMyRequests.filter((request) =>
        request.assignments?.some((assignment) => ["accepted", "en_route", "on_task"].includes(assignment.status)),
      ),
    [activeMyRequests],
  );

  return (
    <DashboardShell
      title="Resource Dispatch"
      subtitle="Create structured incidents, track ranked responder assignments, and add community verification signals to nearby emergencies."
      user={user}
      onSwitchRole={onSwitchRole}
      onLogout={onLogout}
      topLeftOverlay={
        <RescuedRequestsMenu
          requests={rescuedRequests}
          open={rescuedMenuOpen}
          onToggle={() => setRescuedMenuOpen((current) => !current)}
          onClose={() => setRescuedMenuOpen(false)}
        />
      }
    >
      <div className="grid gap-6 xl:grid-cols-[1.2fr,0.8fr]">
        <div className="space-y-6">
          <RequestForm
            requester={user}
            onSubmit={handleSubmit}
            onLocationSync={handleLocationSync}
            submitting={submitting}
            duplicateNotice={duplicateNotice}
          />
          {verificationNotice ? (
            <div
              className={`rounded-xl border p-4 text-sm shadow-tactical ${
                verificationNotice.warnings?.length
                  ? "border-yellow/40 bg-yellow/10 text-yellow"
                  : "border-primary/30 bg-primary/10 text-on-surface"
              }`}
            >
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant">Gemini image verification</p>
              <p className="mt-2 font-semibold text-on-surface">
                {verificationNotice.is_disaster === false
                  ? "Image flagged as non-disaster evidence"
                  : verificationNotice.confidence != null
                    ? `Disaster cues detected (confidence ${Math.round((verificationNotice.confidence || 0) * 100)}%)`
                    : "No image attached for vision check"}
              </p>
              {verificationNotice.labels?.length ? (
                <p className="mt-2 text-xs text-on-surface-variant">Labels: {verificationNotice.labels.join(", ")}</p>
              ) : null}
              {verificationNotice.reason ? <p className="mt-2 text-xs text-on-surface-variant">{verificationNotice.reason}</p> : null}
              {verificationNotice.warnings?.length ? (
                <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-yellow">
                  {verificationNotice.warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
          {submitError ? (
            <div className="rounded-xl border border-red/30 bg-red/10 p-4 text-sm text-red shadow-tactical">
              {submitError}
            </div>
          ) : null}
          <MapView requests={requests} volunteers={volunteers} center={[user.lat, user.lng]} />
          {liveTrackedRequests.length ? (
            <section className="space-y-4 rounded-xl bg-surface-container p-6 shadow-tactical">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Live Volunteer Tracking</p>
                <h2 className="mt-2 font-headline text-2xl font-extrabold tracking-tight text-on-surface">Assigned responders in motion</h2>
              </div>
              {liveTrackedRequests.map((request) => (
                <LiveTrackingCard key={request.id} request={request} />
              ))}
            </section>
          ) : null}
        </div>
        <div className="space-y-6">
          <MetricStrip
            items={[
              { label: "My Requests", value: activeMyRequests.length },
              { label: "Rescued", value: rescuedRequests.length },
              {
                label: "High Priority",
                value: requests.filter((item) => item.priority_level === "HIGH" || item.priority_level === "CRITICAL").length,
              },
              { label: "Nearby Alerts", value: nearbyRequests.length },
            ]}
          />
          <section className="space-y-4">
            <SectionHeader
              eyebrow="My Requests"
              title="Raised by you"
              caption="Monitor assignment status, see why responders were selected, and track live movement until the incident is resolved."
            />
            {activeMyRequests.map((request) => (
              <RequestCard
                key={request.id}
                request={request}
                compact
                footer={<VolunteerLocationPanel request={request} />}
                actions={
                  <button
                    type="button"
                    disabled={resolvingId === request.id}
                    onClick={() => handleResolve(request.id)}
                    className="rounded bg-green px-4 py-3 text-xs font-bold uppercase tracking-[0.18em] text-on-primary disabled:opacity-50"
                  >
                    {resolvingId === request.id ? "Closing..." : "Mark Rescued"}
                  </button>
                }
              />
            ))}
            {!activeMyRequests.length ? (
              <div className="rounded-xl bg-surface-container p-6 text-sm text-on-surface-variant shadow-tactical">
                You have not raised any requests yet.
              </div>
            ) : null}
          </section>
          <section className="space-y-4">
            <SectionHeader
              eyebrow="Community Verification"
              title="Nearby raised requests"
              caption="If you are close enough to witness an active incident, you can confirm it and increase its effective priority."
            />
            {nearbyRequests.map((request) => (
              <RequestCard
                key={request.id}
                request={request}
                compact
                footer={<p className="text-xs text-on-surface-variant">Distance: {request.distance_km} km from your location</p>}
                actions={
                  <button
                    type="button"
                    disabled={request.supported_by_me || supportingId === request.id}
                    onClick={() => handleSupport(request.id)}
                    className="rounded bg-primary px-4 py-3 text-xs font-bold uppercase tracking-[0.18em] text-on-primary disabled:opacity-50"
                  >
                    {request.supported_by_me ? "Verification Submitted" : supportingId === request.id ? "Confirming..." : "Confirm Incident"}
                  </button>
                }
              />
            ))}
            {!nearbyRequests.length ? (
              <div className="rounded-xl bg-surface-container p-6 text-sm text-on-surface-variant shadow-tactical">
                No active nearby incidents are awaiting community confirmation around your current location.
              </div>
            ) : null}
          </section>
        </div>
      </div>
    </DashboardShell>
  );
}

export function DashboardShell({ title, subtitle, user, onSwitchRole, onLogout, topLeftOverlay = null, children }) {
  const navigate = useNavigate();

  const switchRole = async () => {
    const nextRole = user.role === "requester" ? "volunteer" : "requester";
    await onSwitchRole?.(nextRole);
    navigate(`/${nextRole}`, { replace: true });
  };

  return (
    <div className="min-h-screen bg-tactical">
      <header className="sticky top-0 z-20 border-b border-white/5 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 md:px-8">
          <div>
            <p className="font-headline text-xl font-black uppercase tracking-tight text-primary">DisasterIQ</p>
            <p className="text-xs uppercase tracking-[0.2em] text-on-surface-variant">{user.role} console</p>
          </div>
          <div className="flex flex-wrap justify-end gap-3">
            {user.role !== "admin" ? (
              <button
                type="button"
                onClick={switchRole}
                className="rounded bg-primary px-4 py-3 text-xs font-bold uppercase tracking-[0.2em] text-on-primary"
              >
                Use as {user.role === "requester" ? "Volunteer" : "Requester"}
              </button>
            ) : null}
            <button
              type="button"
              onClick={onLogout}
              className="rounded bg-surface-container px-4 py-3 text-xs font-bold uppercase tracking-[0.2em] text-on-surface"
            >
              Logout
            </button>
          </div>
        </div>
      </header>
      <main className="relative mx-auto max-w-7xl px-4 py-8 md:px-8">
        {topLeftOverlay ? <div className="absolute -left-4 top-4 z-10 md:-left-6 md:top-8"
>{topLeftOverlay}</div> : null}
        <div className="mb-8 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Sentinel Command</p>
            <h1 className="mt-2 font-headline text-4xl font-extrabold tracking-tight text-on-surface">{title}</h1>
            <p className="mt-2 max-w-2xl text-sm text-on-surface-variant">{subtitle}</p>
          </div>
          <div className="rounded-xl bg-surface-container px-5 py-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant">Operator</p>
            <p className="mt-1 text-sm font-semibold text-on-surface">{user.name}</p>
          </div>
        </div>
        {children}
      </main>
    </div>
  );
}

function MetricStrip({ items }) {
  return (
    <div className={`grid gap-4 ${items.length === 4 ? "md:grid-cols-2 xl:grid-cols-4" : "md:grid-cols-3"}`}>
      {items.map((item) => (
        <div key={item.label} className="rounded-xl bg-surface-container p-5 shadow-tactical">
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant">{item.label}</div>
          <div className="mt-2 font-headline text-3xl font-extrabold tracking-tight text-on-surface">{item.value}</div>
        </div>
      ))}
    </div>
  );
}

function RescuedRequestsMenu({ requests, open, onToggle, onClose }) {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={onToggle}
        className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-surface-container/95 shadow-tactical backdrop-blur"
        aria-label="Toggle rescued requests"
        aria-expanded={open}
      >
        <div className="space-y-1.5">
          <span className="block h-0.5 w-5 rounded-full bg-on-surface" />
          <span className="block h-0.5 w-5 rounded-full bg-on-surface" />
          <span className="block h-0.5 w-5 rounded-full bg-on-surface" />
        </div>
      </button>
      {open ? (
        <div className="mt-3 w-[min(26rem,calc(100vw-3rem))] rounded-2xl border border-white/10 bg-surface-container p-5 shadow-tactical">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Rescued Requests</p>
              <h2 className="mt-2 font-headline text-xl font-extrabold tracking-tight text-on-surface">Completed incidents</h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded bg-surface-container-high px-3 py-2 text-xs font-bold uppercase tracking-[0.18em] text-on-surface"
            >
              Close
            </button>
          </div>
          <div className="mt-4 space-y-3">
            {requests.length ? (
              requests.map((request) => (
                <div key={request.id} className="rounded-xl bg-surface-container-low p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-on-surface">{request.title}</h3>
                      <p className="mt-1 text-xs uppercase tracking-[0.18em] text-on-surface-variant">{request.incident_type}</p>
                    </div>
                    <span className="rounded bg-green/15 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.18em] text-green">
                      Rescued
                    </span>
                  </div>
                  <p className="mt-3 text-sm text-on-surface-variant">{request.description}</p>
                </div>
              ))
            ) : (
              <div className="rounded-xl bg-surface-container-low p-4 text-sm text-on-surface-variant">
                No rescued requests yet.
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SectionHeader({ eyebrow, title, caption }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">{eyebrow}</p>
      <h2 className="mt-2 font-headline text-2xl font-extrabold tracking-tight text-on-surface">{title}</h2>
      <p className="mt-1 text-sm text-on-surface-variant">{caption}</p>
    </div>
  );
}

function LiveTrackingCard({ request }) {
  const activeAssignments = request.assignments.filter((assignment) => ["accepted", "en_route", "on_task"].includes(assignment.status));
  const routeLines = activeAssignments
    .filter((assignment) => assignment.volunteer)
    .map((assignment) => ({
      id: `route-${request.id}-${assignment.id}`,
      from: { lat: assignment.volunteer.lat, lng: assignment.volunteer.lng },
      to: { lat: request.lat, lng: request.lng },
      color: assignment.status === "en_route" ? "#10b981" : "#f59e0b",
    }));

  return (
    <div className="rounded-xl bg-surface-container-low p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-headline text-xl font-extrabold tracking-tight text-on-surface">{request.title}</h3>
          <p className="mt-1 text-sm text-on-surface-variant">Live responder positions update after assignment acceptance and location sharing.</p>
        </div>
        <div className="rounded bg-surface-container-high px-3 py-2 text-sm font-semibold text-on-surface">
          {activeAssignments.length} live volunteer{activeAssignments.length === 1 ? "" : "s"}
        </div>
      </div>
      <div className="mt-4">
        <MapView
          requests={[request]}
          volunteers={activeAssignments.map((assignment) => assignment.volunteer).filter(Boolean)}
          center={[request.lat, request.lng]}
          height="300px"
          routes={routeLines}
        />
      </div>
    </div>
  );
}

function VolunteerLocationPanel({ request }) {
  const activeAssignments = request.assignments?.filter((assignment) => ["accepted", "en_route", "on_task"].includes(assignment.status)) || [];

  if (!activeAssignments.length) {
    return <p className="text-xs text-on-surface-variant">Waiting for a ranked responder to accept the assignment and begin sharing live position.</p>;
  }

  return (
    <div className="space-y-2 rounded bg-surface-container-high p-4">
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant">Current Volunteer Location</p>
      {activeAssignments.map((assignment) => (
        <div key={assignment.id} className="rounded bg-surface-container-low px-3 py-3 text-sm text-on-surface">
          <div className="font-semibold">{assignment.volunteer?.name || `Volunteer ${assignment.volunteer_id}`}</div>
          <div className="mt-1 text-on-surface-variant">Status: {assignment.status.replace("_", " ")}</div>
          <div className="mt-1 text-on-surface-variant">Selection basis: {assignment.reason}</div>
          <div className="mt-1 text-on-surface-variant">Distance to you: {formatDistanceToRequest(request, assignment.volunteer)}</div>
        </div>
      ))}
    </div>
  );
}

function formatDistanceToRequest(request, volunteer) {
  if (!volunteer || typeof volunteer.lat !== "number" || typeof volunteer.lng !== "number") {
    return "location unavailable";
  }

  const distanceKm = haversineKm(request.lat, request.lng, volunteer.lat, volunteer.lng);
  if (distanceKm < 1) {
    return `${Math.max(1, Math.round(distanceKm * 1000))} meters`;
  }
  return `${distanceKm.toFixed(1)} km`;
}

function haversineKm(lat1, lng1, lat2, lng2) {
  const toRadians = (value) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const originLat = toRadians(lat1);
  const destinationLat = toRadians(lat2);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(originLat) * Math.cos(destinationLat) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * earthRadiusKm * Math.asin(Math.sqrt(a));
}
