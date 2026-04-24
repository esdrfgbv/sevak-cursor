import { useState } from "react";
import { getCurrentPosition } from "../services/location";

const volunteerSkillOptions = ["Medical", "Search and Rescue", "Swift Water Rescue", "Logistics", "Electrical", "Firefighting"];

export default function Login({ onLogin, loading, error }) {
  const [role, setRole] = useState("requester");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [skills, setSkills] = useState(["Medical"]);
  const [location, setLocation] = useState({ lat: 13.0827, lng: 80.2707 });
  const [locationMessage, setLocationMessage] = useState("");

  const toggleSkill = (skill) => {
    setSkills((current) => (current.includes(skill) ? current.filter((item) => item !== skill) : [...current, skill]));
  };

  const useCurrentLocation = async () => {
    setLocationMessage("Requesting your current location...");
    try {
      const nextLocation = await getCurrentPosition();
      setLocation(nextLocation);
      setLocationMessage("Current location captured.");
    } catch (error) {
      setLocationMessage(error.message);
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    await onLogin({
      name,
      role,
      phone,
      lat: Number(location.lat),
      lng: Number(location.lng),
      skills: role === "volunteer" ? skills : [],
    });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-tactical px-4">
      <div className="w-full max-w-md rounded-2xl border border-white/5 bg-surface-container-low p-8 shadow-tactical">
        <div className="mb-8 text-center">
          <p className="font-headline text-3xl font-black uppercase tracking-tight text-primary">DisasterIQ</p>
          <p className="mt-2 text-sm text-on-surface-variant">Intelligent disaster response and volunteer coordination</p>
        </div>
        <form onSubmit={submit} className="space-y-6">
          <div className="grid grid-cols-3 gap-3">
            {["requester", "volunteer", "admin"].map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setRole(item)}
                className={`rounded-lg px-3 py-4 text-xs font-bold uppercase tracking-[0.18em] transition ${
                  role === item ? "bg-primary text-on-primary shadow-glow" : "bg-surface-container text-on-surface-variant"
                }`}
              >
                {item}
              </button>
            ))}
          </div>
          <Field label="Name">
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              placeholder="Asha Patel"
              className="w-full rounded-lg bg-surface-container-lowest px-4 py-3 text-sm text-on-surface outline-none"
            />
          </Field>
          <Field label="Phone">
            <input
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="+91 99999 12345"
              className="w-full rounded-lg bg-surface-container-lowest px-4 py-3 text-sm text-on-surface outline-none"
            />
          </Field>
          {role === "volunteer" ? (
            <>
              <div className="space-y-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant">Current Location</p>
                <button
                  type="button"
                  onClick={useCurrentLocation}
                  className="w-full rounded bg-surface-container px-4 py-3 text-xs font-bold uppercase tracking-[0.18em] text-on-surface"
                >
                  Fetch Current Location
                </button>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Latitude">
                    <input
                      type="number"
                      step="0.000001"
                      value={location.lat}
                      onChange={(event) => setLocation({ ...location, lat: event.target.value })}
                      className="w-full rounded-lg bg-surface-container-lowest px-4 py-3 text-sm text-on-surface outline-none"
                    />
                  </Field>
                  <Field label="Longitude">
                    <input
                      type="number"
                      step="0.000001"
                      value={location.lng}
                      onChange={(event) => setLocation({ ...location, lng: event.target.value })}
                      className="w-full rounded-lg bg-surface-container-lowest px-4 py-3 text-sm text-on-surface outline-none"
                    />
                  </Field>
                </div>
                {locationMessage ? <p className="text-xs text-on-surface-variant">{locationMessage}</p> : null}
              </div>
              <div className="space-y-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant">Volunteer Skills</p>
                <div className="flex flex-wrap gap-2">
                  {volunteerSkillOptions.map((skill) => (
                    <button
                      key={skill}
                      type="button"
                      onClick={() => toggleSkill(skill)}
                      className={`rounded px-3 py-2 text-xs font-semibold ${
                        skills.includes(skill) ? "bg-primary text-on-primary" : "bg-surface-container text-on-surface-variant"
                      }`}
                    >
                      {skill}
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : null}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-primary px-5 py-4 text-sm font-bold uppercase tracking-[0.2em] text-on-primary transition hover:brightness-110 disabled:opacity-60"
          >
            {loading ? "Entering..." : "Enter System"}
          </button>
          {error ? <p className="text-sm text-red-300">{error}</p> : null}
        </form>
      </div>
    </div>
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
