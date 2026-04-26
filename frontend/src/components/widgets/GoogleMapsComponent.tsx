import { useEffect, useMemo, useState } from "react";
import {
  CircleF,
  GoogleMap,
  InfoWindowF,
  LoadScript,
  MarkerClustererF,
  MarkerF,
  PolylineF,
} from "@react-google-maps/api";
import { AlertTriangle, Layers, LocateFixed, Navigation, Users, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { tasksApi, volunteersApi, type Task, type User } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { priorityReason } from "@/lib/decision-labels";

const HYDERABAD_CENTER = { lat: 17.3850, lng: 78.4867 };
const PRIMARY_ZONE_RADIUS_METERS = 50000;

const mapOptions: google.maps.MapOptions = {
  disableDefaultUI: true,
  zoomControl: true,
  streetViewControl: false,
  mapTypeControl: false,
  fullscreenControl: true,
};

const priorityIcon: Record<string, string> = {
  CRITICAL: "http://maps.google.com/mapfiles/ms/icons/red-dot.png",
  HIGH: "http://maps.google.com/mapfiles/ms/icons/orange-dot.png",
  MEDIUM: "http://maps.google.com/mapfiles/ms/icons/yellow-dot.png",
  LOW: "http://maps.google.com/mapfiles/ms/icons/green-dot.png",
};

const priorityColor: Record<string, string> = {
  CRITICAL: "#dc2626",
  HIGH: "#f97316",
  MEDIUM: "#eab308",
  LOW: "#22c55e",
};

type MapType = "roadmap" | "satellite" | "hybrid" | "terrain";

export function GoogleMapsComponent({ height = "h-[640px]" }: { height?: string }) {
  const { user, refreshLocation } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [volunteers, setVolunteers] = useState<User[]>([]);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [mapType, setMapType] = useState<MapType>("roadmap");
  const [showClusters, setShowClusters] = useState(true);
  const [showRoutes, setShowRoutes] = useState(false);
  const [showZone, setShowZone] = useState(true);

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;

  const center = useMemo(() => {
    if (user?.lat && user?.lng) return { lat: user.lat, lng: user.lng };
    if (tasks[0]) return { lat: tasks[0].lat, lng: tasks[0].lng };
    return HYDERABAD_CENTER;
  }, [tasks, user?.lat, user?.lng]);

  useEffect(() => {
    let isMounted = true;

    const fetchMapData = async () => {
      try {
        const [taskData, volunteerData] = await Promise.all([
          tasksApi.list(),
          volunteersApi.search({ lat: center.lat, lng: center.lng, radius_km: 50 }),
        ]);

        if (isMounted) {
          setTasks(taskData);
          setVolunteers(volunteerData);
          setSelectedTask((current) => current ?? taskData[0] ?? null);
        }
      } catch (error) {
        console.error("Failed to load map data:", error);
      }
    };

    fetchMapData();
    const interval = window.setInterval(fetchMapData, 10000);
    return () => {
      isMounted = false;
      window.clearInterval(interval);
    };
  }, [center.lat, center.lng]);

  const routeLines = useMemo(() => {
    if (!showRoutes || tasks.length === 0) return [];

    return volunteers.slice(0, 12).map((volunteer) => {
      const nearestTask = tasks.reduce((nearest, task) => {
        const currentDistance = Math.hypot(task.lat - volunteer.lat, task.lng - volunteer.lng);
        const nearestDistance = Math.hypot(nearest.lat - volunteer.lat, nearest.lng - volunteer.lng);
        return currentDistance < nearestDistance ? task : nearest;
      }, tasks[0]);

      return {
        id: `${volunteer.id}-${nearestTask.id}`,
        path: [
          { lat: volunteer.lat, lng: volunteer.lng },
          { lat: nearestTask.lat, lng: nearestTask.lng },
        ],
      };
    });
  }, [showRoutes, tasks, volunteers]);

  const toggleMapType = () => {
    const types: MapType[] = ["roadmap", "satellite", "hybrid", "terrain"];
    const index = types.indexOf(mapType);
    setMapType(types[(index + 1) % types.length]);
  };

  if (!apiKey) {
    return (
      <div className={cn("flex w-full items-center justify-center rounded-xl border border-border bg-muted/40 p-6", height)}>
        <div className="max-w-md text-center">
          <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-warning" />
          <h3 className="text-sm font-semibold">Google Maps API key missing</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Add `VITE_GOOGLE_MAPS_API_KEY=your_key_here` to `frontend/.env` and restart Vite to render the real map.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("relative w-full overflow-hidden rounded-xl border border-border", height)}>
      <LoadScript googleMapsApiKey={apiKey}>
        <GoogleMap
          mapContainerStyle={{ width: "100%", height: "100%" }}
          center={center}
          zoom={10}
          mapTypeId={mapType}
          options={mapOptions}
        >
          {showZone && (
            <CircleF
              center={HYDERABAD_CENTER}
              radius={PRIMARY_ZONE_RADIUS_METERS}
              options={{
                strokeColor: "#ef4444",
                strokeOpacity: 0.8,
                strokeWeight: 2,
                fillColor: "#ef4444",
                fillOpacity: 0.08,
              }}
            />
          )}

          {routeLines.map((route) => (
            <PolylineF
              key={route.id}
              path={route.path}
              options={{
                strokeColor: "#2563eb",
                strokeOpacity: 0.65,
                strokeWeight: 3,
              }}
            />
          ))}

          {showClusters ? (
            <MarkerClustererF>
              {(clusterer) => (
                <>
                  {tasks.map((task) => (
                    <MarkerF
                      key={task.id}
                      position={{ lat: task.lat, lng: task.lng }}
                      clusterer={clusterer}
                      icon={{ url: priorityIcon[task.priority_level] || priorityIcon.LOW }}
                      title={`${task.priority_level}: ${task.title}`}
                      onClick={() => setSelectedTask(task)}
                    />
                  ))}
                </>
              )}
            </MarkerClustererF>
          ) : (
            tasks.map((task) => (
              <MarkerF
                key={task.id}
                position={{ lat: task.lat, lng: task.lng }}
                icon={{ url: priorityIcon[task.priority_level] || priorityIcon.LOW }}
                title={`${task.priority_level}: ${task.title}`}
                onClick={() => setSelectedTask(task)}
              />
            ))
          )}

          {volunteers.map((volunteer) => (
            <MarkerF
              key={`vol-${volunteer.id}`}
              position={{ lat: volunteer.lat, lng: volunteer.lng }}
              title={`${volunteer.name} (${volunteer.status})`}
              icon={{ url: "http://maps.google.com/mapfiles/ms/icons/blue-dot.png" }}
            />
          ))}

          {selectedTask && (
            <InfoWindowF
              position={{ lat: selectedTask.lat, lng: selectedTask.lng }}
              onCloseClick={() => setSelectedTask(null)}
            >
              <div className="max-w-[240px] space-y-1 text-sm">
                <div className="text-xs font-semibold uppercase" style={{ color: priorityColor[selectedTask.priority_level] || "#16a34a" }}>
                  {selectedTask.priority_level} · {selectedTask.mode}
                </div>
                <div className="font-semibold">{selectedTask.title}</div>
                <div className="text-xs text-slate-600">{selectedTask.incident_type}</div>
                <div className="text-xs text-slate-600">
                  {selectedTask.assignments.length} assigned
                </div>
                <div className="text-xs text-slate-700">{priorityReason(selectedTask)}</div>
              </div>
            </InfoWindowF>
          )}
        </GoogleMap>
      </LoadScript>

      <div className="absolute right-4 top-4 z-40 flex gap-2">
        <Button type="button" size="sm" variant="secondary" className="gap-2 shadow-md" onClick={toggleMapType}>
          <Layers className="h-4 w-4" />
          {mapType}
        </Button>
        <Button type="button" size="sm" variant="secondary" className="gap-2 shadow-md" onClick={() => refreshLocation().catch(console.error)}>
          <LocateFixed className="h-4 w-4" />
          GPS
        </Button>
      </div>

      <div className="absolute left-4 top-4 z-40 flex flex-col gap-2">
        <Button type="button" size="sm" variant={showZone ? "default" : "secondary"} className="justify-start gap-2 shadow-md" onClick={() => setShowZone((value) => !value)}>
          <Zap className="h-4 w-4" />
          Primary Zone
        </Button>
        <Button type="button" size="sm" variant={showClusters ? "default" : "secondary"} className="justify-start gap-2 shadow-md" onClick={() => setShowClusters((value) => !value)}>
          <Users className="h-4 w-4" />
          Clusters
        </Button>
        <Button type="button" size="sm" variant={showRoutes ? "default" : "secondary"} className="justify-start gap-2 shadow-md" onClick={() => setShowRoutes((value) => !value)}>
          <Navigation className="h-4 w-4" />
          Routes
        </Button>
      </div>

      <div className="absolute bottom-4 left-4 z-40 rounded-lg border border-border bg-card/95 p-3 text-xs shadow-md backdrop-blur">
        <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-foreground">Priority</div>
        {Object.entries(priorityColor).map(([priority, color]) => (
          <div key={priority} className="flex items-center gap-2 py-1">
            <span className="h-4 w-4 rounded-full shadow-sm" style={{ backgroundColor: color }} />
            <span className="capitalize">{priority.toLowerCase()}</span>
          </div>
        ))}
        <div className="mt-2 flex items-center gap-2 border-t border-border pt-2">
          <span className="h-4 w-4 rounded-full bg-blue-600 shadow-sm" />
          <span>Volunteer</span>
        </div>
      </div>
    </div>
  );
}
