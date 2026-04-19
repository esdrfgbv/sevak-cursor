import { useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { tasks, volunteers, type Task } from "@/lib/mock-data";
import { PriorityBadge, StatusBadge } from "@/components/widgets/PriorityBadge";
import { Button } from "@/components/ui/button";
import { X, MapPin, Clock, Users, Star, Zap, Filter, ListChecks, Search } from "lucide-react";
import { cn } from "@/lib/utils";

function MatchScore({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-2 min-w-[100px]">
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div className="h-full bg-gradient-to-r from-primary to-primary-glow" style={{ width: `${score}%` }} />
      </div>
      <span className="text-xs font-semibold tabular-nums">{score}%</span>
    </div>
  );
}

const Tasks = () => {
  const [selected, setSelected] = useState<Task | null>(tasks[0]);
  const matches = volunteers.slice(0, 3).map((v, i) => ({
    ...v, score: [96, 91, 87][i], skillMatch: [98, 92, 84][i],
  }));

  return (
    <AppShell title="Task Management" subtitle="47 active · 23 unassigned · 6 critical">
      <div className="flex h-[calc(100vh-4rem)]">
        <div className={cn("flex-1 flex flex-col min-w-0 transition-all", selected && "lg:mr-[440px]")}>
          {/* Filters */}
          <div className="px-6 py-4 border-b border-border bg-card/40 flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[240px] max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input placeholder="Filter tasks…" className="w-full h-9 pl-9 pr-3 text-sm bg-secondary/60 border border-border rounded-md outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
            {["All", "Critical", "Open", "Assigned", "In Progress"].map((f, i) => (
              <button key={f} className={cn(
                "h-9 px-3 text-xs font-medium rounded-md border",
                i === 0 ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-muted-foreground hover:text-foreground"
              )}>{f}</button>
            ))}
            <Button size="sm" variant="outline" className="h-9 ml-auto gap-1.5"><Filter className="h-3.5 w-3.5" /> Advanced</Button>
          </div>

          {/* Stats strip */}
          <div className="px-6 py-3 border-b border-border bg-card/20 grid grid-cols-4 gap-px text-center">
            {[
              { label: "Open", value: 23, tone: "text-warning" },
              { label: "Assigned", value: 12, tone: "text-primary" },
              { label: "In Progress", value: 9, tone: "text-primary-glow" },
              { label: "Completed", value: 184, tone: "text-success" },
            ].map(s => (
              <div key={s.label} className="px-3">
                <div className={cn("text-2xl font-semibold tabular-nums", s.tone)}>{s.value}</div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Task table */}
          <div className="flex-1 overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-card/95 backdrop-blur border-b border-border">
                <tr className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  <th className="text-left font-medium py-2.5 px-6 w-24">Priority</th>
                  <th className="text-left font-medium py-2.5 px-2">Task</th>
                  <th className="text-left font-medium py-2.5 px-2 hidden md:table-cell">Location</th>
                  <th className="text-left font-medium py-2.5 px-2 hidden lg:table-cell">Status</th>
                  <th className="text-left font-medium py-2.5 px-2 w-32">Matched</th>
                  <th className="text-left font-medium py-2.5 px-6 hidden md:table-cell w-24">ETA</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((t) => (
                  <tr
                    key={t.id}
                    onClick={() => setSelected(t)}
                    className={cn(
                      "border-b border-border cursor-pointer transition-colors group",
                      selected?.id === t.id ? "bg-primary/5" : "hover:bg-muted/40"
                    )}
                  >
                    <td className="py-3 px-6"><PriorityBadge priority={t.priority} /></td>
                    <td className="py-3 px-2 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-mono text-muted-foreground">{t.id}</span>
                        <span className="font-medium truncate">{t.title}</span>
                      </div>
                      <div className="flex gap-1 mt-1">
                        {t.skills.slice(0, 3).map(s => (
                          <span key={s} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{s}</span>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 px-2 text-muted-foreground hidden md:table-cell">
                      <div className="flex items-center gap-1.5"><MapPin className="h-3 w-3" />{t.location}</div>
                    </td>
                    <td className="py-3 px-2 hidden lg:table-cell"><StatusBadge status={t.status} /></td>
                    <td className="py-3 px-2">
                      <div className="flex items-center gap-2">
                        <div className="flex -space-x-1.5">
                          {volunteers.slice(0, Math.min(3, t.matched)).map(v => (
                            <div key={v.id} className="h-6 w-6 rounded-full bg-gradient-to-br from-primary-glow to-primary text-white text-[9px] font-semibold flex items-center justify-center ring-2 ring-card">
                              {v.initials}
                            </div>
                          ))}
                        </div>
                        <span className="text-xs font-medium tabular-nums">+{t.matched}</span>
                      </div>
                    </td>
                    <td className="py-3 px-6 text-muted-foreground hidden md:table-cell">
                      <div className="flex items-center gap-1.5"><Clock className="h-3 w-3" />{t.eta}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Side panel */}
        {selected && (
          <aside className="hidden lg:flex fixed right-0 top-16 bottom-0 w-[440px] bg-card border-l border-border flex-col shadow-lifted animate-slide-up z-20">
            <div className="px-5 py-4 border-b border-border flex items-start justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <PriorityBadge priority={selected.priority} />
                  <span className="text-[11px] font-mono text-muted-foreground">{selected.id}</span>
                </div>
                <h2 className="mt-1.5 text-base font-semibold leading-snug text-balance">{selected.title}</h2>
              </div>
              <button onClick={() => setSelected(null)} className="text-muted-foreground hover:text-foreground p-1 -m-1">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="px-5 py-4 grid grid-cols-3 gap-3 border-b border-border text-xs">
              <div>
                <div className="text-muted-foreground text-[10px] uppercase tracking-wider mb-1">Location</div>
                <div className="font-medium">{selected.location}</div>
              </div>
              <div>
                <div className="text-muted-foreground text-[10px] uppercase tracking-wider mb-1">ETA</div>
                <div className="font-medium">{selected.eta}</div>
              </div>
              <div>
                <div className="text-muted-foreground text-[10px] uppercase tracking-wider mb-1">Matched</div>
                <div className="font-medium tabular-nums">{selected.matched} volunteers</div>
              </div>
            </div>

            <div className="px-5 py-3 border-b border-border">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Required Skills</div>
              <div className="flex flex-wrap gap-1.5">
                {selected.skills.map(s => (
                  <span key={s} className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-accent text-accent-foreground">{s}</span>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-auto">
              <div className="px-5 py-3 flex items-center gap-2">
                <Zap className="h-3.5 w-3.5 text-primary" />
                <h3 className="text-xs font-semibold uppercase tracking-wider">AI-Matched Volunteers</h3>
              </div>
              <div className="px-5 pb-5 space-y-2.5">
                {matches.map((v, i) => (
                  <div key={v.id} className={cn(
                    "rounded-lg border p-3.5 transition-all",
                    i === 0 ? "border-primary/30 bg-primary/[0.03] shadow-elegant" : "border-border hover:border-primary/20"
                  )}>
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary-glow to-primary text-white text-xs font-semibold flex items-center justify-center">
                          {v.initials}
                        </div>
                        <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-success ring-2 ring-card" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{v.name}</span>
                          {i === 0 && <span className="text-[9px] font-semibold uppercase tracking-wider text-primary bg-primary/10 px-1.5 py-0.5 rounded">Top</span>}
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                          <span className="flex items-center gap-0.5"><Star className="h-3 w-3 fill-warning text-warning" />{v.rating}</span>
                          <span>·</span>
                          <span>{v.distanceKm} km</span>
                          <span>·</span>
                          <span>{v.tasksCompleted} tasks</span>
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 space-y-2">
                      <div>
                        <div className="flex justify-between text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                          <span>Match score</span><span className="text-foreground font-semibold tabular-nums">{v.score}%</span>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-primary to-primary-glow" style={{ width: `${v.score}%` }} />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-[11px]">
                        <div>
                          <div className="text-muted-foreground">Skill match</div>
                          <MatchScore score={v.skillMatch} />
                        </div>
                        <div>
                          <div className="text-muted-foreground">Reliability</div>
                          <MatchScore score={v.reliability} />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="px-5 py-4 border-t border-border bg-card/60 backdrop-blur space-y-2">
              <Button className="w-full bg-primary hover:bg-primary/90 gap-2"><Zap className="h-4 w-4" /> Assign Best Match · Amelia Hart</Button>
              <Button variant="outline" className="w-full">View all 7 matches</Button>
            </div>
          </aside>
        )}
      </div>
    </AppShell>
  );
};

export default Tasks;
