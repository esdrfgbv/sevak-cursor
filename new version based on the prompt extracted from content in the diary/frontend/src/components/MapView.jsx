import { MapContainer, Marker, Popup, Polyline, TileLayer } from "react-leaflet";
import L from "leaflet";

const createIcon = (color) =>
  L.divIcon({
    className: "",
    html: `<div style="width:14px;height:14px;border-radius:9999px;background:${color};box-shadow:0 0 0 5px rgba(255,255,255,0.08), 0 0 18px ${color};border:2px solid #0b1326"></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });

const priorityColors = {
  HIGH: "#ff6b6b",
  MEDIUM: "#f59e0b",
  LOW: "#4d8eff",
};

export default function MapView({ requests = [], volunteers = [], center = [12.9716, 77.5946], height = "420px", routes = [] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-white/5 bg-surface-container-low shadow-tactical" style={{ height }}>
      <MapContainer center={center} zoom={13} scrollWheelZoom className="h-full w-full">
        <TileLayer
          attribution="OpenStreetMap"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {requests.map((request) => (
          <Marker
            key={`request-${request.id}`}
            position={[request.lat, request.lng]}
            icon={createIcon(priorityColors[request.priority_level] || "#4d8eff")}
          >
            <Popup>
              <div className="space-y-1">
                <div className="font-semibold">{request.title}</div>
                <div>Status: {request.status}</div>
                <div>Priority: {request.priority_level}</div>
              </div>
            </Popup>
          </Marker>
        ))}
        {volunteers.map((volunteer) => (
          <Marker
            key={`volunteer-${volunteer.id}`}
            position={[volunteer.lat, volunteer.lng]}
            icon={createIcon(volunteer.status === "available" ? "#10b981" : "#adc6ff")}
          >
            <Popup>
              <div className="space-y-1">
                <div className="font-semibold">{volunteer.name}</div>
                <div>Status: {volunteer.status}</div>
                <div>Availability: {volunteer.availability ? "Ready" : "Busy"}</div>
              </div>
            </Popup>
          </Marker>
        ))}
        {routes.map((route) => (
          <Polyline
            key={route.id}
            positions={[
              [route.from.lat, route.from.lng],
              [route.to.lat, route.to.lng],
            ]}
            pathOptions={{ color: route.color || "#22c55e", weight: 4, opacity: 0.75, dashArray: route.dashArray || "8 10" }}
          />
        ))}
      </MapContainer>
    </div>
  );
}
