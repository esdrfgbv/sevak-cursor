import { AppShell } from "@/components/layout/AppShell";
import { KpiCard } from "@/components/widgets/KpiCard";
import { OpsMap } from "@/components/widgets/OpsMap";
import { ActivityFeed } from "@/components/widgets/ActivityFeed";
import { PriorityBadge, StatusBadge } from "@/components/widgets/PriorityBadge";
import { tasks } from "@/lib/mock-data";
import { Activity, AlertTriangle, CheckCircle2, Users, ArrowUpRight, Sparkles } from "lucide-react";

const Index = () => {
  return (
    <AppShell title="Command Center" subtitle="Riverside Floods · Operation NEPTUNE-04 · 142 active responders">
      <div className="p-6 space-y-6">
        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <KpiCard label="Active Tasks" value="47" delta="+12%" trend="up" icon={Activity} tone="primary" spark={[8,12,10,14,11,16,13,18,15,21]} />
          <KpiCard label="Volunteers Available" value="312" delta="+8%" trend="up" icon={Users} tone="success" spark={[20,22,21,25,24,28,27,30,29,33]} />
          <KpiCard label="Tasks Completed (24h)" value="184" delta="+22%" trend="up" icon={CheckCircle2} tone="success" spark={[40,52,48,60,68,75,82,90,98,110]} />
          <KpiCard label="Critical Alerts" value="6" delta="-3" trend="down" icon={AlertTriangle} tone="danger" spark={[12,11,13,10,9,8,9,7,6,6]} />
        </div>

        {/* Map + Feed */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2 bg-card border border-border rounded-xl shadow-elegant overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold tracking-tight">Operations Map</h3>
                <p className="text-xs text-muted-foreground">Real-time task density · 8 zones monitored</p>
              </div>
              <div className="flex items-center gap-1 text-xs">
                <button className="px-2.5 py-1 rounded-md bg-primary text-primary-foreground font-medium">Heatmap</button>
                <button className="px-2.5 py-1 rounded-md text-muted-foreground hover:bg-muted">Satellite</button>
                <button className="px-2.5 py-1 rounded-md text-muted-foreground hover:bg-muted">Routes</button>
              </div>
            </div>
            <div className="p-4">
              <OpsMap height="h-[420px]" />
            </div>
          </div>
          <div className="xl:col-span-1 h-[510px]">
            <ActivityFeed />
          </div>
        </div>

        {/* AI Insights + recent tasks */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2 bg-card border border-border rounded-xl shadow-elegant">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <h3 className="text-sm font-semibold tracking-tight">High-Priority Queue</h3>
              <button className="text-xs text-primary font-medium hover:underline flex items-center gap-1">
                View all tasks <ArrowUpRight className="h-3 w-3" />
              </button>
            </div>
            <div className="divide-y divide-border">
              {tasks.slice(0, 5).map((t) => (
                <div key={t.id} className="px-5 py-3.5 flex items-center gap-4 hover:bg-muted/40 transition-colors group">
                  <PriorityBadge priority={t.priority} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-mono text-muted-foreground">{t.id}</span>
                      <h4 className="text-sm font-medium truncate">{t.title}</h4>
                    </div>
                    <div className="text-xs text-muted-foreground truncate">{t.location} · ETA {t.eta}</div>
                  </div>
                  <div className="hidden md:flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs font-medium tabular-nums">{t.matched}</span>
                    <span className="text-[11px] text-muted-foreground">matched</span>
                  </div>
                  <StatusBadge status={t.status} />
                </div>
              ))}
            </div>
          </div>

          <div className="bg-gradient-to-br from-primary to-primary-glow text-primary-foreground rounded-xl shadow-lifted p-5 relative overflow-hidden">
            <div className="absolute inset-0 grid-bg opacity-10" />
            <div className="relative">
              <div className="flex items-center gap-2 text-[11px] font-semibold tracking-wider uppercase opacity-90">
                <Sparkles className="h-3.5 w-3.5" /> AI Insight
              </div>
              <h3 className="mt-3 text-lg font-semibold leading-snug text-balance">
                Medical volunteer shortage predicted in Sector 4 within 90 minutes.
              </h3>
              <p className="mt-2 text-sm opacity-90 leading-relaxed">
                Based on inflow patterns and current ratios, dispatch 6 additional triage-trained volunteers from Northbank to maintain SLAs.
              </p>
              <div className="mt-4 grid grid-cols-3 gap-3 text-center">
                <div>
                  <div className="text-xl font-semibold tabular-nums">94%</div>
                  <div className="text-[10px] uppercase tracking-wider opacity-75">Confidence</div>
                </div>
                <div>
                  <div className="text-xl font-semibold tabular-nums">6</div>
                  <div className="text-[10px] uppercase tracking-wider opacity-75">Volunteers</div>
                </div>
                <div>
                  <div className="text-xl font-semibold tabular-nums">12m</div>
                  <div className="text-[10px] uppercase tracking-wider opacity-75">ETA</div>
                </div>
              </div>
              <button className="mt-5 w-full bg-white text-primary font-medium text-sm rounded-md py-2 hover:bg-white/90 transition-colors">
                Auto-dispatch suggestion
              </button>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
};

export default Index;
