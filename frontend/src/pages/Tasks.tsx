import { useState, useEffect } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, MapPin, Clock, Users, Star, Zap, Filter, Search, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { tasksApi, type Task } from "@/lib/api";
import { toast } from "sonner";

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

const priorityColor: Record<string, string> = {
  CRITICAL: "bg-danger/10 text-danger ring-danger/30",
  HIGH: "bg-warning/10 text-warning ring-warning/30",
  MEDIUM: "bg-primary/10 text-primary ring-primary/20",
  LOW: "bg-muted text-muted-foreground ring-border",
};
const statusColor: Record<string, string> = {
  pending: "bg-warning/10 text-warning",
  assigned: "bg-primary/10 text-primary",
  completed: "bg-success/10 text-success",
};

const Tasks = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Task | null>(null);
  const [filter, setFilter] = useState("All");
  const [modeFilter, setModeFilter] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");

  const fetchTasks = async () => {
    try {
      const data = await tasksApi.list();
      setTasks(data);
      if (selected) {
        const updated = data.find(t => t.id === selected.id);
        if (updated) setSelected(updated);
      }
    } catch { /* ignore */ } finally { setLoading(false); }
  };

  useEffect(() => {
    fetchTasks();
    const interval = setInterval(fetchTasks, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleMatch = async (taskId: number) => {
    try {
      const result = await tasksApi.match(taskId);
      toast.success(`Matched ${result.top_volunteers.length} volunteers${result.auto_assigned ? ' (auto-assigned)' : ''}`);
      fetchTasks();
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : "Matching failed"); }
  };

  const filtered = tasks.filter(t => {
    if (filter === "Critical" && !["CRITICAL", "HIGH"].includes(t.priority_level)) return false;
    if (filter === "Open" && t.status !== "pending") return false;
    if (filter === "Assigned" && t.status !== "assigned") return false;
    if (filter === "Completed" && t.status !== "completed") return false;
    if (modeFilter === "DISASTER" && t.mode !== "DISASTER") return false;
    if (modeFilter === "NGO" && t.mode !== "NGO") return false;
    if (searchQuery && !t.title.toLowerCase().includes(searchQuery.toLowerCase()) && !t.incident_type.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const stats = {
    pending: tasks.filter(t => t.status === "pending").length,
    assigned: tasks.filter(t => t.status === "assigned").length,
    completed: tasks.filter(t => t.status === "completed").length,
    disaster: tasks.filter(t => t.mode === "DISASTER").length,
    ngo: tasks.filter(t => t.mode === "NGO").length,
  };

  if (loading) {
    return <AppShell title="Tasks" subtitle="Loading..."><div className="flex items-center justify-center h-96"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div></AppShell>;
  }

  return (
    <AppShell title="Task Management" subtitle={`${tasks.length} total · ${stats.pending} pending · ${stats.disaster} DISASTER · ${stats.ngo} NGO`}>
      <div className="flex h-[calc(100vh-4rem)]">
        <div className={cn("flex-1 flex flex-col min-w-0 transition-all", selected && "lg:mr-[440px]")}>
          {/* Filters */}
          <div className="px-6 py-4 border-b border-border bg-card/40 flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[240px] max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input placeholder="Filter tasks..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                className="w-full h-9 pl-9 pr-3 text-sm bg-secondary/60 border border-border rounded-md outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
            {["All", "Critical", "Open", "Assigned", "Completed"].map(f => (
              <button key={f} onClick={() => setFilter(f)} className={cn(
                "h-9 px-3 text-xs font-medium rounded-md border",
                filter === f ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-muted-foreground hover:text-foreground"
              )}>{f}</button>
            ))}
            <div className="flex gap-1 ml-2">
              {["All", "DISASTER", "NGO"].map(m => (
                <button key={m} onClick={() => setModeFilter(m)} className={cn(
                  "h-9 px-3 text-xs font-medium rounded-md border",
                  modeFilter === m ? (m === "DISASTER" ? "bg-red-500 text-white border-red-500" : m === "NGO" ? "bg-green-600 text-white border-green-600" : "bg-primary text-primary-foreground border-primary") : "bg-card border-border text-muted-foreground"
                )}>{m}</button>
              ))}
            </div>
          </div>

          {/* Stats strip */}
          <div className="px-6 py-3 border-b border-border bg-card/20 grid grid-cols-5 gap-px text-center">
            {[
              { label: "Pending", value: stats.pending, tone: "text-warning" },
              { label: "Assigned", value: stats.assigned, tone: "text-primary" },
              { label: "Completed", value: stats.completed, tone: "text-success" },
              { label: "Disaster", value: stats.disaster, tone: "text-red-500" },
              { label: "NGO", value: stats.ngo, tone: "text-green-500" },
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
                  <th className="text-left font-medium py-2.5 px-2 hidden md:table-cell">Mode</th>
                  <th className="text-left font-medium py-2.5 px-2 hidden lg:table-cell">Status</th>
                  <th className="text-left font-medium py-2.5 px-2 w-32">Assigned</th>
                  <th className="text-left font-medium py-2.5 px-6 hidden md:table-cell w-24">Score</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(t => (
                  <tr key={t.id} onClick={() => setSelected(t)}
                    className={cn("border-b border-border cursor-pointer transition-colors group",
                      selected?.id === t.id ? "bg-primary/5" : "hover:bg-muted/40")}>
                    <td className="py-3 px-6">
                      <span className={cn("text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full ring-1", priorityColor[t.priority_level] || priorityColor.LOW)}>
                        {t.priority_level}
                      </span>
                    </td>
                    <td className="py-3 px-2 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-mono text-muted-foreground">T-{t.id}</span>
                        <span className="font-medium truncate">{t.title}</span>
                      </div>
                      <div className="flex gap-1 mt-1">
                        {t.skills.slice(0, 3).map(s => (
                          <span key={s.id} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{s.name}</span>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 px-2 hidden md:table-cell">
                      <Badge className={cn("text-[10px]", t.mode === "DISASTER" ? "bg-red-500 text-white" : "bg-green-600 text-white")}>{t.mode}</Badge>
                    </td>
                    <td className="py-3 px-2 hidden lg:table-cell">
                      <span className={cn("text-[10px] font-semibold uppercase px-2 py-0.5 rounded", statusColor[t.status] || "bg-muted text-muted-foreground")}>{t.status}</span>
                    </td>
                    <td className="py-3 px-2">
                      <div className="flex items-center gap-2">
                        <Users className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-xs font-medium tabular-nums">{t.assignments.length}</span>
                      </div>
                    </td>
                    <td className="py-3 px-6 text-muted-foreground hidden md:table-cell tabular-nums">{t.priority_score}</td>
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
                  <span className={cn("text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full ring-1", priorityColor[selected.priority_level])}>
                    {selected.priority_level}
                  </span>
                  <Badge className={cn("text-[10px]", selected.mode === "DISASTER" ? "bg-red-500 text-white" : "bg-green-600 text-white")}>{selected.mode}</Badge>
                  <span className="text-[11px] font-mono text-muted-foreground">T-{selected.id}</span>
                </div>
                <h2 className="mt-1.5 text-base font-semibold leading-snug">{selected.title}</h2>
              </div>
              <button onClick={() => setSelected(null)} className="text-muted-foreground hover:text-foreground p-1 -m-1"><X className="h-4 w-4" /></button>
            </div>

            <div className="px-5 py-3 text-sm text-muted-foreground border-b border-border">{selected.description}</div>

            <div className="px-5 py-4 grid grid-cols-3 gap-3 border-b border-border text-xs">
              <div>
                <div className="text-muted-foreground text-[10px] uppercase tracking-wider mb-1">Type</div>
                <div className="font-medium">{selected.incident_type}</div>
              </div>
              <div>
                <div className="text-muted-foreground text-[10px] uppercase tracking-wider mb-1">People</div>
                <div className="font-medium">{selected.people_count}</div>
              </div>
              <div>
                <div className="text-muted-foreground text-[10px] uppercase tracking-wider mb-1">Score</div>
                <div className="font-medium tabular-nums">{selected.priority_score}/100</div>
              </div>
            </div>

            <div className="px-5 py-3 border-b border-border">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Required Skills</div>
              <div className="flex flex-wrap gap-1.5">
                {selected.skills.map(s => (
                  <span key={s.id} className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-accent text-accent-foreground">{s.name}</span>
                ))}
              </div>
            </div>

            {/* Assignments */}
            <div className="flex-1 overflow-auto">
              <div className="px-5 py-3 flex items-center gap-2">
                <Zap className="h-3.5 w-3.5 text-primary" />
                <h3 className="text-xs font-semibold uppercase tracking-wider">Assigned Volunteers ({selected.assignments.length})</h3>
              </div>
              <div className="px-5 pb-5 space-y-2.5">
                {selected.assignments.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No volunteers assigned yet</p>
                ) : (
                  selected.assignments.map((a, i) => (
                    <div key={a.id} className={cn("rounded-lg border p-3.5", i === 0 ? "border-primary/30 bg-primary/[0.03]" : "border-border")}>
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary-glow to-primary text-white text-xs font-semibold flex items-center justify-center">
                          {(a.volunteer?.name || '??').split(' ').map(w => w[0]).join('').slice(0, 2)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{a.volunteer?.name || `Vol #${a.volunteer_id}`}</span>
                            {i === 0 && <span className="text-[9px] font-semibold uppercase tracking-wider text-primary bg-primary/10 px-1.5 py-0.5 rounded">Top</span>}
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                            <span className="flex items-center gap-0.5"><Star className="h-3 w-3 fill-warning text-warning" />{a.volunteer?.rating?.toFixed(1) || 'N/A'}</span>
                            <span>·</span>
                            <Badge variant="outline" className="text-[10px] h-4">{a.status}</Badge>
                          </div>
                        </div>
                      </div>
                      <div className="mt-2">
                        <div className="flex justify-between text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                          <span>Match score</span><span className="text-foreground font-semibold tabular-nums">{(a.score * 100).toFixed(0)}%</span>
                        </div>
                        <MatchScore score={Math.round(a.score * 100)} />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="px-5 py-4 border-t border-border bg-card/60 backdrop-blur space-y-2">
              <Button className="w-full bg-primary hover:bg-primary/90 gap-2" onClick={() => handleMatch(selected.id)}>
                <Zap className="h-4 w-4" /> Run Matching Engine
              </Button>
            </div>
          </aside>
        )}
      </div>
    </AppShell>
  );
};

export default Tasks;
