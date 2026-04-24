import { useEffect, useMemo, useState } from "react";

import MapView from "../components/MapView";
import RequestCard from "../components/RequestCard";
import VolunteerStatus from "../components/VolunteerStatus";
import { DashboardShell } from "./RequesterDashboard";
import {
  claimRequest,
  fetchAdminOverview,
  fetchNearbyVolunteerRequests,
  fetchVolunteerTasks,
  updateAssignment,
  updateVolunteerLocation,
  updateVolunteerStatus,
} from "../services/api";
import { buildGoogleMapsDirectionsUrl, watchCurrentPosition } from "../services/location";

function assignmentActionsForStatus(status) {
  if (status === "accepted") {
    return [
      ["en_route", "En Route"],
      ["on_task", "Start Task"],
      ["completed", "Complete"],
    ];
  }
  if (status === "en_route") {
    return [
      ["on_task", "Start Task"],
      ["completed", "Complete"],
    ];
  }
  if (status === "on_task") {
    return [["completed", "Complete"]];
  }
  return [["completed", "Complete"]];
}

export default function VolunteerDashboard({ user, onUserChange, onSwitchRole, onLogout }) {
  const [tasks, setTasks] = useState([]);
  const [requests, setRequests] = useState([]);
  const [volunteers, setVolunteers] = useState([]);
  const [nearbyRequests, setNearbyRequests] = useState([]);
  const [claimingId, setClaimingId] = useState(null);

  const load = async () => {
    const [taskData, overview, nearbyData] = await Promise.all([
      fetchVolunteerTasks(user.id),
      fetchAdminOverview(),
      fetchNearbyVolunteerRequests(user.id),
    ]);
    setTasks(taskData);
    setRequests(overview.requests);
    setVolunteers(overview.volunteers);
    setNearbyRequests(nearbyData);
    const refreshedVolunteer = overview.volunteers.find((volunteer) => volunteer.id === user.id);
    if (
      refreshedVolunteer &&
      (refreshedVolunteer.status !== user.status ||
        refreshedVolunteer.availability !== user.availability ||
        refreshedVolunteer.lat !== user.lat ||
        refreshedVolunteer.lng !== user.lng)
    ) {
      onUserChange(refreshedVolunteer);
    }
  };

  useEffect(() => {
    load();
    const timer = setInterval(load, 7000);
    return () => clearInterval(timer);
  }, [user.id]);

  const activeTrackedTask = useMemo(
    () => tasks.find((task) => ["accepted", "en_route", "on_task"].includes(task.status)),
    [tasks],
  );

  useEffect(() => {
    if (!activeTrackedTask) {
      return undefined;
    }

    let previousKey = `${user.lat},${user.lng}`;
    const stopWatching = watchCurrentPosition(
      async (location) => {
        const nextKey = `${location.lat},${location.lng}`;
        if (nextKey === previousKey) {
          return;
        }
        previousKey = nextKey;
        const updated = await updateVolunteerLocation(user.id, location);
        onUserChange(updated);
      },
      () => {},
    );

    return () => stopWatching();
  }, [activeTrackedTask?.id, user.id]);

  const handleStatusChange = async (status) => {
    const updated = await updateVolunteerStatus(user.id, { status, availability: status === "available" || status === "completed" });
    onUserChange(updated);
    await load();
  };

  const handleMove = async (latOffset, lngOffset) => {
    const updated = await updateVolunteerLocation(user.id, {
      lat: Number((user.lat + latOffset).toFixed(6)),
      lng: Number((user.lng + lngOffset).toFixed(6)),
    });
    onUserChange(updated);
    await load();
  };

  const handleSetLocation = async (location) => {
    const updated = await updateVolunteerLocation(user.id, location);
    onUserChange(updated);
    await load();
  };

  const handleAssignment = async (assignmentId, status) => {
    await updateAssignment(assignmentId, status);
    await load();
  };

  const handleClaimRequest = async (requestId) => {
    setClaimingId(requestId);
    try {
      await claimRequest(requestId, user.id);
      await load();
    } finally {
      setClaimingId(null);
    }
  };

  const assignedRequestMap = new Map(tasks.map((task) => [task.request_id, task]));
  const taskRequestDetails = tasks
    .map((task) => requests.find((request) => request.id === task.request_id))
    .filter(Boolean);
  const volunteerRoutes = taskRequestDetails.map((request) => ({
    id: `route-${request.id}`,
    from: { lat: user.lat, lng: user.lng },
    to: { lat: request.lat, lng: request.lng },
    color: "#22c55e",
  }));

  return (
    <DashboardShell
      title="Volunteer Operations"
      subtitle="Assignments are issued automatically from the simulation roster. Update your movement status and share live location once you are mobilized."
      user={user}
      onSwitchRole={onSwitchRole}
      onLogout={onLogout}
    >
      <div className="grid gap-6 xl:grid-cols-[0.9fr,1.1fr]">
        <div className="space-y-6">
          <VolunteerStatus volunteer={user} onChangeStatus={handleStatusChange} onMove={handleMove} onSetLocation={handleSetLocation} />
          <MapView
            requests={taskRequestDetails.length ? taskRequestDetails : nearbyRequests.slice(0, 6)}
            volunteers={[user, ...volunteers.filter((volunteer) => volunteer.id !== user.id)]}
            center={[user.lat, user.lng]}
            routes={volunteerRoutes}
          />
        </div>
        <div className="space-y-6">
          <section className="space-y-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Assigned Work</p>
              <h2 className="mt-2 font-headline text-2xl font-extrabold tracking-tight text-on-surface">Assignments selected for you</h2>
            </div>
            {tasks.map((task) => {
              const linkedRequest = requests.find((request) => request.id === task.request_id);
              const directionsUrl = linkedRequest
                ? buildGoogleMapsDirectionsUrl({ lat: user.lat, lng: user.lng }, { lat: linkedRequest.lat, lng: linkedRequest.lng })
                : null;

              return (
                <div key={task.id} className="rounded-xl bg-surface-container p-6 shadow-tactical">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">{task.status}</p>
                      <h3 className="mt-2 font-headline text-2xl font-extrabold tracking-tight text-on-surface">Request #{task.request_id}</h3>
                      <p className="mt-2 text-sm text-on-surface-variant">Selection basis: {task.reason}</p>
                    </div>
                    <div className="rounded bg-surface-container-high px-3 py-2 text-right">
                      <div className="font-headline text-2xl font-extrabold text-primary">{Math.round(task.score * 100)}</div>
                      <div className="text-[10px] uppercase tracking-[0.2em] text-on-surface-variant">Match</div>
                    </div>
                  </div>
                  {linkedRequest ? (
                    <div className="mt-4 rounded bg-surface-container-low p-4 text-sm text-on-surface-variant">
                      <div className="font-semibold text-on-surface">{linkedRequest.title}</div>
                      <div className="mt-1">Destination: {linkedRequest.lat.toFixed(4)}, {linkedRequest.lng.toFixed(4)}</div>
                    </div>
                  ) : null}
                  <div className="mt-5 flex flex-wrap gap-2">
                    {assignmentActionsForStatus(task.status).map(([status, label]) => (
                      <button
                        key={status}
                        type="button"
                        onClick={() => handleAssignment(task.id, status)}
                        className="rounded bg-surface-container-high px-4 py-3 text-xs font-bold uppercase tracking-[0.18em] text-on-surface"
                      >
                        {label}
                      </button>
                    ))}
                    {directionsUrl ? (
                      <a
                        href={directionsUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded bg-primary px-4 py-3 text-xs font-bold uppercase tracking-[0.18em] text-on-primary"
                      >
                        Open in Google Maps
                      </a>
                    ) : null}
                  </div>
                </div>
              );
            })}
            {!tasks.length ? (
              <div className="rounded-xl bg-surface-container p-6 text-sm text-on-surface-variant shadow-tactical">
                No assignments yet. Nearby active requests will still appear below so newly registered volunteers can pick them up.
              </div>
            ) : null}
          </section>
          <section className="space-y-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Nearby Requests</p>
              <h2 className="mt-2 font-headline text-2xl font-extrabold tracking-tight text-on-surface">Nearby incidents within response radius</h2>
              <p className="mt-1 text-sm text-on-surface-variant">Use this list for local self-assignment when you are close enough and operationally available.</p>
            </div>
            {nearbyRequests.map((request) => {
              const directionsUrl = buildGoogleMapsDirectionsUrl({ lat: user.lat, lng: user.lng }, { lat: request.lat, lng: request.lng });
              const alreadyAssigned = assignedRequestMap.has(request.id);
              return (
                <RequestCard
                  key={request.id}
                  request={request}
                  compact
                  footer={<p className="text-xs text-on-surface-variant">Distance: {request.distance_km} km from your current location</p>}
                  actions={
                    <>
                      <button
                        type="button"
                        disabled={alreadyAssigned || claimingId === request.id}
                        onClick={() => handleClaimRequest(request.id)}
                        className="rounded bg-primary px-4 py-3 text-xs font-bold uppercase tracking-[0.18em] text-on-primary disabled:opacity-50"
                      >
                        {alreadyAssigned ? "Already Assigned" : claimingId === request.id ? "Joining..." : "Join Response"}
                      </button>
                      <a
                        href={directionsUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded bg-surface-container-high px-4 py-3 text-xs font-bold uppercase tracking-[0.18em] text-on-surface"
                      >
                        Navigate
                      </a>
                    </>
                  }
                />
              );
            })}
            {!nearbyRequests.length ? (
              <div className="rounded-xl bg-surface-container p-6 text-sm text-on-surface-variant shadow-tactical">
                No active incidents are within the nearby response radius right now.
              </div>
            ) : null}
          </section>
        </div>
      </div>
    </DashboardShell>
  );
}
