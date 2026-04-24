import { useEffect, useState } from "react";

import MapView from "../components/MapView";
import RequestCard from "../components/RequestCard";
import { DashboardShell } from "./RequesterDashboard";
import { fetchAdminOverview } from "../services/api";

export default function AdminDashboard({ user, onLogout }) {
  const [overview, setOverview] = useState({ totals: {}, requests: [], volunteers: [] });

  const load = async () => {
    setOverview(await fetchAdminOverview());
  };

  useEffect(() => {
    load();
    const timer = setInterval(load, 8000);
    return () => clearInterval(timer);
  }, []);

  const totalCards = [
    ["Total Requests", overview.totals.requests_total || 0],
    ["Active Requests", overview.totals.requests_active || 0],
    ["Completed", overview.totals.requests_completed || 0],
    ["Critical Cases", overview.totals.critical_cases || 0],
    ["Available Volunteers", overview.totals.available_volunteers || 0],
  ];
  const prioritizedRequests = [...overview.requests].sort((left, right) => {
    if ((right.priority_score || 0) !== (left.priority_score || 0)) {
      return (right.priority_score || 0) - (left.priority_score || 0);
    }
    return (right.supporter_count || 0) - (left.supporter_count || 0);
  });
  const escalationCandidates = prioritizedRequests.filter(
    (request) =>
      request.priority_level === "HIGH" ||
      request.priority_level === "CRITICAL" ||
      (request.supporter_count || 0) >= 2 ||
      request.assignments.length === 0,
  );
  const activeResponders = overview.volunteers.filter((volunteer) => volunteer.status !== "available");

  return (
    <DashboardShell
      title="Sentinel Overview"
      subtitle="Monitor prioritized incidents, verification signals, and responder movement so critical cases can be escalated and resourced quickly."
      user={user}
      onLogout={onLogout}
    >
      <div className="grid gap-6 lg:grid-cols-[1.2fr,0.8fr]">
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-5">
            {totalCards.map(([label, value]) => (
              <div key={label} className="rounded-xl bg-surface-container p-5 shadow-tactical">
                <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant">{label}</div>
                <div className="mt-2 font-headline text-3xl font-extrabold tracking-tight text-on-surface">{value}</div>
              </div>
            ))}
          </div>
          <MapView requests={overview.requests} volunteers={overview.volunteers} />
          <div className="space-y-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Prioritized Incidents</p>
              <h2 className="mt-2 font-headline text-2xl font-extrabold tracking-tight text-on-surface">Requests ranked for oversight</h2>
              <p className="mt-1 text-sm text-on-surface-variant">Sorted by priority score, verification activity, and current assignment coverage.</p>
            </div>
            {prioritizedRequests.slice(0, 6).map((request) => (
              <RequestCard
                key={request.id}
                request={request}
                compact
                footer={
                  <p className="text-xs text-on-surface-variant">
                    Verification signals: {request.supporter_count || 0} | Assigned responders: {request.assignments.length} | Live tracking:{" "}
                    {request.assignments.some((assignment) => ["accepted", "en_route", "on_task"].includes(assignment.status)) ? "active" : "waiting"}
                  </p>
                }
              />
            ))}
          </div>
        </div>
        <aside className="space-y-4">
          <div className="rounded-xl bg-surface-container p-5 shadow-tactical">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Escalation Queue</p>
            <h2 className="mt-2 font-headline text-2xl font-extrabold tracking-tight text-on-surface">Incidents needing action</h2>
            <div className="mt-4 space-y-3">
              {escalationCandidates.slice(0, 4).map((request) => (
                <div key={request.id} className="rounded bg-surface-container-high p-4">
                  <div className="font-semibold text-on-surface">{request.title}</div>
                  <div className="mt-1 text-xs text-on-surface-variant">
                    Priority {request.priority_score} | Confirmations {request.supporter_count || 0} | Assignments {request.assignments.length}
                  </div>
                </div>
              ))}
              {!escalationCandidates.length ? (
                <p className="text-sm text-on-surface-variant">No incidents currently meet the escalation threshold.</p>
              ) : null}
            </div>
          </div>
          <div className="rounded-xl bg-surface-container p-5 shadow-tactical">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Active Responders</p>
            <h2 className="mt-2 font-headline text-2xl font-extrabold tracking-tight text-on-surface">Field movement snapshot</h2>
            <p className="mt-1 text-sm text-on-surface-variant">{activeResponders.length} responder(s) currently assigned, en route, or on task.</p>
          </div>
          {overview.volunteers.map((volunteer) => (
            <div key={volunteer.id} className="rounded-xl bg-surface-container p-5 shadow-tactical">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="font-headline text-xl font-extrabold tracking-tight text-on-surface">{volunteer.name}</h3>
                  <p className="text-xs uppercase tracking-[0.2em] text-on-surface-variant">
                    {volunteer.skills?.map((skill) => skill.name).join(", ") || "General"}
                  </p>
                </div>
                <span
                  className={`rounded px-3 py-2 text-[10px] font-bold uppercase tracking-[0.2em] ${
                    volunteer.status === "available" ? "bg-green/15 text-green" : "bg-primary/15 text-primary"
                  }`}
                >
                  {volunteer.status}
                </span>
              </div>
              <p className="mt-4 text-sm text-on-surface-variant">
                {volunteer.lat.toFixed(4)}, {volunteer.lng.toFixed(4)}
              </p>
              <p className="mt-2 text-xs text-on-surface-variant">
                Availability score input: {volunteer.availability ? "available" : "occupied"}
              </p>
            </div>
          ))}
        </aside>
      </div>
    </DashboardShell>
  );
}
