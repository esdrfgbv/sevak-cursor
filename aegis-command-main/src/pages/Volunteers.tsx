import { AppShell } from "@/components/layout/AppShell";
import { volunteers, availabilityColor } from "@/lib/mock-data";
import { Star, MapPin, MessageSquare, Search, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

const skillFilters = ["All Skills", "Medical", "Logistics", "SAR", "Translation", "Counseling", "Electrical"];

const Volunteers = () => {
  return (
    <AppShell title="Volunteer Directory" subtitle="312 available · 142 active · 87 on standby">
      <div className="p-6 space-y-5">
        {/* Filter bar */}
        <div className="bg-card border border-border rounded-xl p-4 shadow-elegant">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[260px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input placeholder="Search by name, skill, or location…" className="w-full h-9 pl-9 pr-3 text-sm bg-secondary/60 border border-border rounded-md outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground mr-1">Distance</span>
              <select className="h-9 px-2.5 text-xs bg-secondary/60 border border-border rounded-md outline-none">
                <option>Within 5 km</option><option>Within 10 km</option><option>Within 25 km</option>
              </select>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground mr-1">Rating</span>
              <select className="h-9 px-2.5 text-xs bg-secondary/60 border border-border rounded-md outline-none">
                <option>4.5+ ★</option><option>4.0+ ★</option><option>3.5+ ★</option>
              </select>
            </div>
            <button className="h-9 px-3 text-xs font-medium border border-border rounded-md hover:bg-muted flex items-center gap-1.5">
              <SlidersHorizontal className="h-3.5 w-3.5" /> Advanced
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5 mt-3">
            {skillFilters.map((s, i) => (
              <button key={s} className={cn(
                "h-7 px-2.5 text-[11px] font-medium rounded-md border transition-colors",
                i === 0 ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-muted-foreground hover:text-foreground hover:border-primary/30"
              )}>{s}</button>
            ))}
          </div>
        </div>

        {/* Cards grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {volunteers.map((v) => (
            <div key={v.id} className="group bg-card border border-border rounded-xl p-4 shadow-elegant hover:shadow-lifted hover:-translate-y-0.5 transition-all">
              <div className="flex items-start gap-3">
                <div className="relative shrink-0">
                  <div className="h-12 w-12 rounded-full bg-gradient-to-br from-primary-glow to-primary text-white text-sm font-semibold flex items-center justify-center shadow-lifted">
                    {v.initials}
                  </div>
                  <span className={cn("absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full ring-2 ring-card", availabilityColor[v.availability])} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h4 className="font-medium text-sm truncate">{v.name}</h4>
                      <div className="text-[11px] text-muted-foreground font-mono">{v.id}</div>
                    </div>
                    <div className="flex items-center gap-0.5 text-xs font-medium">
                      <Star className="h-3.5 w-3.5 fill-warning text-warning" />{v.rating}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-[11px] text-muted-foreground mt-1">
                    <MapPin className="h-3 w-3" />{v.city} · {v.distanceKm} km
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-1 mt-3">
                {v.skills.map(s => (
                  <span key={s} className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-accent text-accent-foreground">{s}</span>
                ))}
              </div>

              <div className="mt-3 space-y-2">
                <div>
                  <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                    <span>Workload</span>
                    <span className="font-medium text-foreground tabular-nums">{v.workload}%</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className={cn("h-full transition-all", v.workload > 70 ? "bg-danger" : v.workload > 40 ? "bg-warning" : "bg-success")} style={{ width: `${v.workload}%` }} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="bg-muted/50 rounded-md px-2 py-1.5">
                    <div className="text-muted-foreground text-[10px]">Reliability</div>
                    <div className="font-semibold tabular-nums">{v.reliability}%</div>
                  </div>
                  <div className="bg-muted/50 rounded-md px-2 py-1.5">
                    <div className="text-muted-foreground text-[10px]">Completed</div>
                    <div className="font-semibold tabular-nums">{v.tasksCompleted}</div>
                  </div>
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
                <span className={cn("text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded",
                  v.availability === "online" ? "bg-success/10 text-success" :
                  v.availability === "busy" ? "bg-warning/10 text-warning" : "bg-muted text-muted-foreground"
                )}>{v.availability}</span>
                <div className="flex items-center gap-1">
                  <button className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground">
                    <MessageSquare className="h-3.5 w-3.5" />
                  </button>
                  <button className="h-7 px-2.5 text-[11px] font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90">
                    Assign
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
};

export default Volunteers;
