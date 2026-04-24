import { useMemo, useState } from "react";
import { getCurrentPosition } from "../services/location";

const skillOptions = [
  "Medical",
  "Search and Rescue",
  "Swift Water Rescue",
  "Logistics",
  "Electrical",
  "Firefighting",
];

const initialState = {
  incident_type: "Medical Emergency",
  title: "",
  description: "",
  required_skills: ["Medical"],
  people_count: 1,
  lat: 13.0827,
  lng: 80.2707,
  image_data: "",
};

export default function RequestForm({ requester, onSubmit, onLocationSync, submitting, duplicateNotice }) {
  const [form, setForm] = useState(initialState);
  const [locationMessage, setLocationMessage] = useState("");
  const [imageMessage, setImageMessage] = useState("No image attached.");

  const locationPreview = useMemo(() => `${Number(form.lat).toFixed(4)}, ${Number(form.lng).toFixed(4)}`, [form.lat, form.lng]);

  const toggleSkill = (skill) => {
    setForm((current) => ({
      ...current,
      required_skills: current.required_skills.includes(skill)
        ? current.required_skills.filter((item) => item !== skill)
        : [...current.required_skills, skill],
    }));
  };

  const useCurrentLocation = async () => {
    setLocationMessage("Requesting browser location...");
    try {
      const location = await getCurrentPosition();
      setForm((current) => ({ ...current, ...location }));
      if (onLocationSync) {
        await onLocationSync(location);
      }
      setLocationMessage("Current location captured. Nearby active requests have been refreshed.");
    } catch (error) {
      setLocationMessage(error.message);
    }
  };

  const handleImageChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      setForm((current) => ({ ...current, image_data: "" }));
      setImageMessage("No image attached.");
      return;
    }

    if (!file.type.startsWith("image/")) {
      setImageMessage("Choose an image file.");
      event.target.value = "";
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setImageMessage("Choose an image under 2 MB.");
      event.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setForm((current) => ({ ...current, image_data: reader.result }));
      setImageMessage(`${file.name} attached for verification.`);
    };
    reader.onerror = () => setImageMessage("Could not read that image.");
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    await onSubmit({
      ...form,
      requester_id: requester?.id,
      people_count: Number(form.people_count),
      lat: Number(form.lat),
      lng: Number(form.lng),
      image_data: form.image_data || null,
    });
    setForm(initialState);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5 rounded-xl bg-surface-container p-6 shadow-tactical">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Initiate New Request</p>
        <h2 className="mt-2 font-headline text-2xl font-extrabold tracking-tight text-on-surface">Create a structured incident record</h2>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Incident Type">
          <select
            value={form.incident_type}
            onChange={(event) => setForm({ ...form, incident_type: event.target.value })}
            className="w-full rounded bg-surface-container-lowest px-4 py-3 text-sm text-on-surface outline-none ring-0"
          >
            <option>Medical Emergency</option>
            <option>Flood Rescue</option>
            <option>Structural Collapse</option>
            <option>Power Failure</option>
            <option>Supply Distribution</option>
          </select>
        </Field>
        <Field label="Request Title">
          <input
            value={form.title}
            onChange={(event) => setForm({ ...form, title: event.target.value })}
            required
            placeholder="Field clinic extraction"
            className="w-full rounded bg-surface-container-lowest px-4 py-3 text-sm text-on-surface outline-none"
          />
        </Field>
      </div>
      <Field label="Situation Description">
        <textarea
          value={form.description}
          onChange={(event) => setForm({ ...form, description: event.target.value })}
          required
          rows={4}
          placeholder="Describe threat level, access constraints, casualties, and immediate needs."
          className="w-full rounded bg-surface-container-lowest px-4 py-3 text-sm text-on-surface outline-none"
        />
      </Field>
      <div className="grid gap-4 md:grid-cols-3">
        <Field label="People Count">
          <input
            type="number"
            min="0"
            value={form.people_count}
            onChange={(event) => setForm({ ...form, people_count: event.target.value })}
            className="w-full rounded bg-surface-container-lowest px-4 py-3 text-sm text-on-surface outline-none"
          />
        </Field>
        <Field label="Latitude">
          <input
            type="number"
            step="0.0001"
            value={form.lat}
            onChange={(event) => setForm({ ...form, lat: event.target.value })}
            className="w-full rounded bg-surface-container-lowest px-4 py-3 text-sm text-on-surface outline-none"
          />
        </Field>
        <Field label="Longitude">
          <input
            type="number"
            step="0.0001"
            value={form.lng}
            onChange={(event) => setForm({ ...form, lng: event.target.value })}
            className="w-full rounded bg-surface-container-lowest px-4 py-3 text-sm text-on-surface outline-none"
          />
        </Field>
      </div>
      <div className="rounded bg-surface-container-low p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant">Incident Location</p>
            <p className="mt-1 text-sm text-on-surface-variant">Fetch your current position or type latitude and longitude above.</p>
          </div>
          <button
            type="button"
            onClick={useCurrentLocation}
            className="rounded bg-surface-container-high px-4 py-3 text-xs font-bold uppercase tracking-[0.18em] text-on-surface"
          >
            Fetch Current Location
          </button>
        </div>
        {locationMessage ? <p className="mt-3 text-xs text-on-surface-variant">{locationMessage}</p> : null}
      </div>
      {duplicateNotice ? (
        <div className="rounded border border-yellow/30 bg-yellow/10 p-4 text-sm text-yellow">
          A similar active incident was detected nearby. The system treated this report as an independent confirmation signal and
          increased the matched incident priority by +{duplicateNotice.pointsAdded}.
          <div className="mt-2 text-xs text-on-surface">
            Matched incident: {duplicateNotice.title} | Updated priority score: {duplicateNotice.score}
          </div>
        </div>
      ) : null}
      <Field label="Evidence Image">
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={handleImageChange}
          className="w-full rounded bg-surface-container-lowest px-4 py-3 text-sm text-on-surface outline-none file:mr-4 file:rounded file:border-0 file:bg-primary file:px-3 file:py-2 file:text-xs file:font-bold file:uppercase file:tracking-[0.18em] file:text-on-primary"
        />
        <p className="mt-2 text-xs text-on-surface-variant">{imageMessage}</p>
      </Field>
      <div className="space-y-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant">Critical Skills</p>
        <div className="flex flex-wrap gap-2">
          {skillOptions.map((skill) => {
            const active = form.required_skills.includes(skill);
            return (
              <button
                key={skill}
                type="button"
                onClick={() => toggleSkill(skill)}
                className={`rounded px-3 py-2 text-xs font-semibold transition ${
                  active ? "bg-primary text-on-primary" : "bg-surface-container-high text-on-surface-variant hover:text-on-surface"
                }`}
              >
                {skill}
              </button>
            );
          })}
        </div>
      </div>
      <div className="flex items-center justify-between rounded bg-surface-container-low px-4 py-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant">Location Preview</p>
          <p className="text-sm font-semibold text-on-surface">{locationPreview}</p>
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="rounded bg-primary px-5 py-3 text-xs font-bold uppercase tracking-[0.2em] text-on-primary transition hover:brightness-110 disabled:opacity-60"
        >
          {submitting ? "Creating..." : "Create Incident"}
        </button>
      </div>
    </form>
  );
}

function Field({ label, children }) {
  return (
    <label className="block space-y-2">
      <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant">{label}</span>
      {children}
    </label>
  );
}
