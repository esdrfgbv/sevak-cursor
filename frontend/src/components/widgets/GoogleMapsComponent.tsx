import { useMemo, useState } from "react";
import { tasks, volunteers, type Priority } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import { Layers, Navigation, Users, Zap } from "lucide-react";

interface MapState {
  mapType: "roadmap" | "satellite" | "terrain";
  showClusters: boolean;
  showRoutes: boolean;
  showHeatmap: boolean;
}

const priorityTone: Record<Priority, string> = {
  critical: "bg-danger ring-danger/30",
  high: "bg-orange-500 ring-orange-500/30",
  medium: "bg-yellow-500 ring-yellow-500/30",
  low: "bg-emerald-500 ring-emerald-500/30",
};

const priorityGlow: Record<Priority, string> = {
  critical: "rgba(220,38,38,.30)",
  high: "rgba(249,115,22,.26)",
  medium: "rgba(234,179,8,.24)",
  low: "rgba(16,185,129,.22)",
};

const mapTypeClass: Record<MapState["mapType"], string> = {
  roadmap: "bg-[#eef4f8]",
  satellite: "bg-[#22352f]",
  terrain: "bg-[#edf2df]",
};

const districtLabels = [
  { name: "Riverside", x: 28, y: 47 },
  { name: "Northbank", x: 58, y: 22 },
  { name: "Old Town", x: 20, y: 76 },
  { name: "Civic Center", x: 47, y: 57 },
  { name: "Westside", x: 14, y: 33 },
];

export function GoogleMapsComponent({ height = "h-[640px]" }: { height?: string }) {
  const [selectedTaskId, setSelectedTaskId] = useState(tasks[0]?.id);
  const [mapState, setMapState] = useState<MapState>({
    mapType: "roadmap",
    showClusters: false,
    showRoutes: false,
    showHeatmap: true,
  });

  const selectedTask = tasks.find((task) => task.id === selectedTaskId) ?? tasks[0];

  const clusterGroups = useMemo(
    () => [
      { id: "west", x: 22, y: 52, count: tasks.filter((task) => task.coords.x < 35).length, tone: "bg-danger" },
      { id: "central", x: 48, y: 45, count: tasks.filter((task) => task.coords.x >= 35 && task.coords.x < 60).length, tone: "bg-primary" },
      { id: "east", x: 67, y: 48, count: tasks.filter((task) => task.coords.x >= 60).length, tone: "bg-warning" },
    ].filter((cluster) => cluster.count > 0),
    []
  );

  const toggleMapType = () => {
    const types: MapState["mapType"][] = ["roadmap", "satellite", "terrain"];
    const currentIndex = types.indexOf(mapState.mapType);
    setMapState((prev) => ({ ...prev, mapType: types[(currentIndex + 1) % types.length] }));
  };

  return (
    <div className={cn("relative w-full overflow-hidden rounded-xl border border-border", height, mapTypeClass[mapState.mapType])}>
      <div className="absolute inset-0">
        <svg className="h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id="river" x1="0" x2="1" y1="0" y2="1">
              <stop offset="0%" stopColor={mapState.mapType === "satellite" ? "#436f83" : "#b9d9eb"} />
              <stop offset="100%" stopColor={mapState.mapType === "satellite" ? "#254b5f" : "#d8ecf7"} />
            </linearGradient>
            <pattern id="mapGrid" width="8" height="8" patternUnits="userSpaceOnUse">
              <path d="M 8 0 L 0 0 0 8" fill="none" stroke={mapState.mapType === "satellite" ? "rgba(255,255,255,.08)" : "rgba(52,72,92,.10)"} strokeWidth="0.25" />
            </pattern>
          </defs>

          <rect width="100" height="100" fill="url(#mapGrid)" />
          <path d="M0,18 C16,26 23,38 36,39 C51,40 56,25 70,28 C82,31 87,48 100,52 L100,68 C82,61 74,48 61,47 C45,45 42,59 27,55 C16,52 9,40 0,37 Z" fill="url(#river)" opacity="0.9" />
          <path d="M4,78 C20,68 32,72 45,62 C60,51 70,48 96,42" fill="none" stroke={mapState.mapType === "satellite" ? "rgba(255,255,255,.36)" : "rgba(71,85,105,.42)"} strokeWidth="1.25" strokeLinecap="round" />
          <path d="M10,20 C30,34 42,29 58,44 C70,55 82,60 96,70" fill="none" stroke={mapState.mapType === "satellite" ? "rgba(255,255,255,.30)" : "rgba(71,85,105,.34)"} strokeWidth="0.9" strokeLinecap="round" />
          <path d="M18,8 L24,92 M44,5 L42,94 M72,10 L66,92" fill="none" stroke={mapState.mapType === "satellite" ? "rgba(255,255,255,.22)" : "rgba(100,116,139,.30)"} strokeWidth="0.55" strokeLinecap="round" />

          {mapState.showRoutes &&
            volunteers.slice(0, 6).map((volunteer) => {
              const nearestTask = tasks.reduce((nearest, task) => {
                const currentDistance = Math.hypot(task.coords.x - volunteer.coords.x, task.coords.y - volunteer.coords.y);
                const nearestDistance = Math.hypot(nearest.coords.x - volunteer.coords.x, nearest.coords.y - volunteer.coords.y);
                return currentDistance < nearestDistance ? task : nearest;
              }, tasks[0]);

              return (
                <line
                  key={volunteer.id}
                  x1={volunteer.coords.x}
                  y1={volunteer.coords.y}
                  x2={nearestTask.coords.x}
                  y2={nearestTask.coords.y}
                  stroke="hsl(var(--primary))"
                  strokeWidth="0.55"
                  strokeDasharray="1.5 1.2"
                  opacity="0.7"
                />
              );
            })}
        </svg>
      </div>

      {mapState.showHeatmap && (
        <div className="absolute inset-0 pointer-events-none">
          {tasks.map((task) => (
            <div
              key={`heat-${task.id}`}
              className="absolute h-32 w-32 -translate-x-1/2 -translate-y-1/2 rounded-full blur-xl"
              style={{
                left: `${task.coords.x}%`,
                top: `${task.coords.y}%`,
                background: `radial-gradient(circle, ${priorityGlow[task.priority]} 0%, transparent 68%)`,
              }}
            />
          ))}
        </div>
      )}

      {districtLabels.map((label) => (
        <div
          key={label.name}
          className={cn(
            "absolute -translate-x-1/2 -translate-y-1/2 rounded bg-background/70 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider shadow-sm backdrop-blur",
            mapState.mapType === "satellite" && "bg-black/35 text-white"
          )}
          style={{ left: `${label.x}%`, top: `${label.y}%` }}
        >
          {label.name}
        </div>
      ))}

      {volunteers.map((volunteer) => (
        <div
          key={volunteer.id}
          className="absolute h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background bg-primary/90 text-[9px] font-bold text-primary-foreground shadow-md"
          style={{ left: `${volunteer.coords.x}%`, top: `${volunteer.coords.y}%` }}
          title={`${volunteer.name} - ${volunteer.availability}`}
        >
          <span className="flex h-full w-full items-center justify-center">{volunteer.initials}</span>
        </div>
      ))}

      {mapState.showClusters
        ? clusterGroups.map((cluster) => (
            <button
              key={cluster.id}
              className={cn(
                "absolute flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-lg font-bold text-white shadow-xl ring-8 ring-white/40",
                cluster.tone
              )}
              style={{ left: `${cluster.x}%`, top: `${cluster.y}%` }}
              type="button"
            >
              {cluster.count}
            </button>
          ))
        : tasks.map((task) => (
            <button
              key={task.id}
              onClick={() => setSelectedTaskId(task.id)}
              className={cn(
                "absolute h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full shadow-lg ring-4 transition hover:scale-125",
                priorityTone[task.priority],
                selectedTaskId === task.id ? "ring-primary/40 scale-125" : "ring-white/70"
              )}
              style={{ left: `${task.coords.x}%`, top: `${task.coords.y}%` }}
              title={`${task.id}: ${task.title}`}
              type="button"
            />
          ))}

      {selectedTask && !mapState.showClusters && (
        <div
          className="absolute w-64 -translate-x-1/2 rounded-lg border border-border bg-card/95 p-3 text-xs shadow-lifted backdrop-blur"
          style={{ left: `${Math.min(Math.max(selectedTask.coords.x, 18), 82)}%`, top: `${Math.max(selectedTask.coords.y - 18, 8)}%` }}
        >
          <div className="flex items-center justify-between gap-3">
            <span className="font-mono text-[10px] text-muted-foreground">{selectedTask.id}</span>
            <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase text-white", priorityTone[selectedTask.priority])}>
              {selectedTask.priority}
            </span>
          </div>
          <div className="mt-1 font-semibold text-foreground">{selectedTask.title}</div>
          <div className="mt-1 text-muted-foreground">{selectedTask.location}</div>
          <div className="mt-2 flex items-center gap-3 text-[11px] text-muted-foreground">
            <span>{selectedTask.matched} matched</span>
            <span>ETA {selectedTask.eta}</span>
          </div>
        </div>
      )}

      <div className="absolute right-4 top-4 z-40 flex gap-2">
        <button
          onClick={toggleMapType}
          className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium shadow-md transition hover:bg-muted"
          title="Toggle map type"
          type="button"
        >
          <Layers className="h-4 w-4" />
          {mapState.mapType}
        </button>
      </div>

      <div className="absolute left-4 top-4 z-40 flex flex-col gap-2">
        <button
          onClick={() => setMapState((prev) => ({ ...prev, showHeatmap: !prev.showHeatmap }))}
          className={cn(
            "flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium shadow-md transition",
            mapState.showHeatmap ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-muted"
          )}
          type="button"
        >
          <Zap className="h-4 w-4" />
          Heatmap
        </button>

        <button
          onClick={() => setMapState((prev) => ({ ...prev, showClusters: !prev.showClusters }))}
          className={cn(
            "flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium shadow-md transition",
            mapState.showClusters ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-muted"
          )}
          type="button"
        >
          <Users className="h-4 w-4" />
          Clusters
        </button>

        <button
          onClick={() => setMapState((prev) => ({ ...prev, showRoutes: !prev.showRoutes }))}
          className={cn(
            "flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium shadow-md transition",
            mapState.showRoutes ? "border-success bg-success text-white" : "border-border bg-card hover:bg-muted"
          )}
          type="button"
        >
          <Navigation className="h-4 w-4" />
          Routes
        </button>
      </div>

      <div className="absolute bottom-4 left-4 z-40 rounded-lg border border-border bg-card/95 p-3 text-xs shadow-md backdrop-blur">
        <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-foreground">Priority</div>
        {(["critical", "high", "medium", "low"] as Priority[]).map((priority) => (
          <div key={priority} className="flex items-center gap-2 py-1">
            <span className={cn("h-4 w-4 rounded-full shadow-sm", priorityTone[priority])} />
            <span className="capitalize">{priority}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
