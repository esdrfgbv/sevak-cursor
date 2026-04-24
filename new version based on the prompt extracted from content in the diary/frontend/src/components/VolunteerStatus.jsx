import { useEffect, useState } from "react";
import { getCurrentPosition } from "../services/location";

const statusOrder = [
  { value: "available", label: "Available" },
  { value: "assigned", label: "Assigned" },
  { value: "en_route", label: "En Route" },
  { value: "on_task", label: "On Task" },
  { value: "completed", label: "Completed" },
];

export default function VolunteerStatus({ volunteer, onChangeStatus, onMove, onSetLocation }) {
  const [draftLocation, setDraftLocation] = useState({ lat: volunteer.lat, lng: volunteer.lng });
  const [locationMessage, setLocationMessage] = useState("Enter your current location before accepting field work.");

  useEffect(() => {
    setDraftLocation({ lat: volunteer.lat, lng: volunteer.lng });
  }, [volunteer.lat, volunteer.lng]);

  const submitLocation = async () => {
    await onSetLocation({
      lat: Number(draftLocation.lat),
      lng: Number(draftLocation.lng),
    });
    setLocationMessage("Current location updated.");
  };

  const useCurrentLocation = async () => {
    setLocationMessage("Requesting your current location...");
    try {
      const location = await getCurrentPosition();
      setDraftLocation(location);
      await onSetLocation(location);
      setLocationMessage("Current location captured.");
    } catch (error) {
      setLocationMessage(error.message);
    }
  };

  return (
    <section className="space-y-5 rounded-xl bg-surface-container p-6 shadow-tactical">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Volunteer Control</p>
          <h2 className="mt-2 font-headline text-2xl font-extrabold tracking-tight text-on-surface">{volunteer.name}</h2>
          <p className="text-sm text-on-surface-variant">Current state: {volunteer.status.replace("_", " ")}</p>
        </div>
        <span className={`rounded px-3 py-2 text-xs font-bold uppercase tracking-[0.2em] ${volunteer.availability ? "bg-green/15 text-green" : "bg-primary/15 text-primary"}`}>
          {volunteer.availability ? "Ready" : "Occupied"}
        </span>
      </div>
      <div className="grid gap-2 sm:grid-cols-5">
        {statusOrder.map((status) => (
          <button
            key={status.value}
            type="button"
            onClick={() => onChangeStatus(status.value)}
            className={`rounded px-3 py-3 text-[10px] font-bold uppercase tracking-[0.16em] transition ${
              volunteer.status === status.value
                ? "bg-primary text-on-primary"
                : "bg-surface-container-high text-on-surface-variant hover:text-on-surface"
            }`}
          >
            {status.label}
          </button>
        ))}
      </div>
      <div className="rounded bg-surface-container-low p-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant">Position Update</p>
          <p className="text-sm text-on-surface">{volunteer.lat.toFixed(4)}, {volunteer.lng.toFixed(4)}</p>
        </div>
        <div className="mb-4 grid gap-3 sm:grid-cols-[1fr,1fr,auto]">
          <input
            type="number"
            step="0.000001"
            value={draftLocation.lat}
            onChange={(event) => setDraftLocation({ ...draftLocation, lat: event.target.value })}
            aria-label="Current latitude"
            className="rounded bg-surface-container-lowest px-4 py-3 text-sm text-on-surface outline-none"
          />
          <input
            type="number"
            step="0.000001"
            value={draftLocation.lng}
            onChange={(event) => setDraftLocation({ ...draftLocation, lng: event.target.value })}
            aria-label="Current longitude"
            className="rounded bg-surface-container-lowest px-4 py-3 text-sm text-on-surface outline-none"
          />
          <button
            type="button"
            onClick={submitLocation}
            className="rounded bg-primary px-4 py-3 text-xs font-bold uppercase tracking-[0.18em] text-on-primary"
          >
            Save Position
          </button>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={useCurrentLocation}
            className="rounded bg-primary px-4 py-3 text-xs font-bold uppercase tracking-[0.2em] text-on-primary"
          >
            Fetch Current Location
          </button>
          <button
            type="button"
            onClick={() => onMove(0.0012, 0.001)}
            className="rounded bg-surface-container-high px-4 py-3 text-xs font-bold uppercase tracking-[0.2em] text-on-surface"
          >
            Move North-East
          </button>
          <button
            type="button"
            onClick={() => onMove(-0.001, -0.0014)}
            className="rounded bg-surface-container-high px-4 py-3 text-xs font-bold uppercase tracking-[0.2em] text-on-surface"
          >
            Move South-West
          </button>
        </div>
        <p className="mt-3 text-xs text-on-surface-variant">{locationMessage}</p>
      </div>
    </section>
  );
}
