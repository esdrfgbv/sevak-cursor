import { tasks, volunteers, type Task } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

const priorityDot: Record<Task["priority"], string> = {
  critical: "bg-danger",
  high: "bg-warning",
  medium: "bg-primary",
  low: "bg-muted-foreground",
};

export function OpsMap({ height = "h-[420px]", showVolunteers = true }: { height?: string; showVolunteers?: boolean }) {
  return (
    <div className={cn("relative w-full overflow-hidden rounded-xl border border-border bg-[hsl(211_30%_96%)] dark:bg-[hsl(211_30%_10%)]", height)}>
      {/* Topographic gradient */}
      <div className="absolute inset-0 grid-bg opacity-40" />
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
        <defs>
          <radialGradient id="heat1" cx="32%" cy="44%" r="22%">
            <stop offset="0%" stopColor="hsl(var(--danger))" stopOpacity="0.45" />
            <stop offset="100%" stopColor="hsl(var(--danger))" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="heat2" cx="22%" cy="72%" r="20%">
            <stop offset="0%" stopColor="hsl(var(--danger))" stopOpacity="0.35" />
            <stop offset="100%" stopColor="hsl(var(--danger))" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="heat3" cx="58%" cy="30%" r="18%">
            <stop offset="0%" stopColor="hsl(var(--warning))" stopOpacity="0.35" />
            <stop offset="100%" stopColor="hsl(var(--warning))" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="100" height="100" fill="url(#heat1)" />
        <rect width="100" height="100" fill="url(#heat2)" />
        <rect width="100" height="100" fill="url(#heat3)" />
        {/* Roads */}
        <path d="M0,55 Q30,40 50,52 T100,48" fill="none" stroke="hsl(var(--border))" strokeWidth="0.6" />
        <path d="M40,0 Q45,40 55,60 T60,100" fill="none" stroke="hsl(var(--border))" strokeWidth="0.6" />
        <path d="M0,80 L100,75" fill="none" stroke="hsl(var(--border))" strokeWidth="0.4" strokeDasharray="1,1" />
      </svg>

      {/* River */}
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
        <path d="M0,38 Q25,30 45,40 T100,35" fill="none" stroke="hsl(211 70% 60% / 0.35)" strokeWidth="2.4" />
      </svg>

      {/* Task markers */}
      {tasks.map((t) => (
        <div
          key={t.id}
          className="absolute -translate-x-1/2 -translate-y-1/2 group"
          style={{ left: `${t.coords.x}%`, top: `${t.coords.y}%` }}
        >
          <div className="relative">
            <span className={cn("absolute inset-0 rounded-full opacity-50", priorityDot[t.priority], t.priority === "critical" && "animate-ping")} />
            <span className={cn("relative block h-3 w-3 rounded-full ring-2 ring-card shadow-lifted", priorityDot[t.priority])} />
          </div>
          <div className="opacity-0 group-hover:opacity-100 pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 whitespace-nowrap bg-card border border-border rounded-md px-2 py-1 text-[11px] shadow-lifted transition-opacity z-20">
            <div className="font-medium">{t.id} · {t.category}</div>
            <div className="text-muted-foreground">{t.location}</div>
          </div>
        </div>
      ))}

      {/* Volunteers */}
      {showVolunteers && volunteers.slice(0, 7).map((v) => (
        <div
          key={v.id}
          className="absolute -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${v.coords.x}%`, top: `${v.coords.y}%` }}
        >
          <div className="h-6 w-6 rounded-full bg-card border border-primary/30 shadow-elegant flex items-center justify-center text-[9px] font-semibold text-primary">
            {v.initials}
          </div>
        </div>
      ))}

      {/* Legend */}
      <div className="absolute bottom-3 left-3 glass border border-border/60 rounded-lg p-2.5 text-[11px] space-y-1.5 shadow-elegant">
        <div className="font-semibold text-foreground/80 uppercase tracking-wider text-[10px] mb-1">Live Operations</div>
        <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-danger" /> Critical task</div>
        <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-warning" /> High priority</div>
        <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-primary" /> Active task</div>
        <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-card border border-primary/30" /> Volunteer</div>
      </div>

      {/* Compass / scale */}
      <div className="absolute top-3 right-3 glass border border-border/60 rounded-lg px-2.5 py-1.5 text-[10px] font-mono text-muted-foreground shadow-elegant">
        38.9072°N · 77.0369°W · z14
      </div>
    </div>
  );
}
