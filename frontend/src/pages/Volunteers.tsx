import { useState, useEffect } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Star, MapPin, MessageSquare, Search, SlidersHorizontal, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { volunteersApi, assignmentsApi, type User } from "@/lib/api";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

const skillFilters = ["All Skills", "Medical", "Logistics", "Search and Rescue", "Firefighting", "Counseling", "Electrical", "First Aid"];

const Volunteers = () => {
  const [volunteers, setVolunteers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSkill, setActiveSkill] = useState("All Skills");
  const [searchQuery, setSearchQuery] = useState("");

  const fetchVolunteers = async () => {
    try {
      const data = await volunteersApi.search({
        skill: activeSkill !== "All Skills" ? activeSkill : undefined,
      });
      setVolunteers(data);
    } catch { /* ignore */ } finally { setLoading(false); }
  };

  useEffect(() => { fetchVolunteers(); }, [activeSkill]);
  useEffect(() => {
    const interval = setInterval(fetchVolunteers, 15000);
    return () => clearInterval(interval);
  }, [activeSkill]);

  const filtered = volunteers.filter(v => {
    if (searchQuery && !v.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const stats = {
    total: volunteers.length,
    available: volunteers.filter(v => v.availability).length,
    busy: volunteers.filter(v => !v.availability).length,
  };

  if (loading) {
    return <AppShell title="Volunteers" subtitle="Loading..."><div className="flex items-center justify-center h-96"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div></AppShell>;
  }

  return (
    <AppShell title="Volunteer Directory" subtitle={`${stats.total} total · ${stats.available} available · ${stats.busy} busy`}>
      <div className="p-6 space-y-5">
        {/* Filter bar */}
        <div className="bg-card border border-border rounded-xl p-4 shadow-elegant">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[260px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input placeholder="Search by name..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                className="w-full h-9 pl-9 pr-3 text-sm bg-secondary/60 border border-border rounded-md outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5 mt-3">
            {skillFilters.map(s => (
              <button key={s} onClick={() => { setActiveSkill(s); setLoading(true); }}
                className={cn(
                  "h-7 px-2.5 text-[11px] font-medium rounded-md border transition-colors",
                  activeSkill === s ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-muted-foreground hover:text-foreground hover:border-primary/30"
                )}>{s}</button>
            ))}
          </div>
        </div>

        {/* Cards grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(v => {
            const initials = v.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
            return (
              <div key={v.id} className="group bg-card border border-border rounded-xl p-4 shadow-elegant hover:shadow-lifted hover:-translate-y-0.5 transition-all">
                <div className="flex items-start gap-3">
                  <div className="relative shrink-0">
                    <div className="h-12 w-12 rounded-full bg-gradient-to-br from-primary-glow to-primary text-white text-sm font-semibold flex items-center justify-center shadow-lifted">
                      {initials}
                    </div>
                    <span className={cn("absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full ring-2 ring-card",
                      v.availability ? "bg-success" : v.status === "assigned" ? "bg-warning" : "bg-muted-foreground/40")} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h4 className="font-medium text-sm truncate">{v.name}</h4>
                        <div className="text-[11px] text-muted-foreground font-mono">V-{v.id}</div>
                      </div>
                      <div className="flex items-center gap-0.5 text-xs font-medium">
                        <Star className="h-3.5 w-3.5 fill-warning text-warning" />{v.rating.toFixed(1)}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1 mt-3">
                  {v.skills.map(s => (
                    <span key={s.id} className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-accent text-accent-foreground">{s.name}</span>
                  ))}
                </div>

                <div className="mt-3 space-y-2">
                  <div>
                    <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                      <span>Workload</span>
                      <span className="font-medium text-foreground tabular-nums">{v.workload}</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className={cn("h-full transition-all", v.workload > 3 ? "bg-danger" : v.workload > 1 ? "bg-warning" : "bg-success")}
                        style={{ width: `${Math.min(v.workload * 20, 100)}%` }} />
                    </div>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
                  <span className={cn("text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded",
                    v.availability ? "bg-success/10 text-success" : "bg-warning/10 text-warning"
                  )}>{v.availability ? "available" : v.status}</span>
                  <div className="flex items-center gap-1">
                    <span className="text-[11px] text-muted-foreground">{v.phone || ''}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
};

export default Volunteers;
