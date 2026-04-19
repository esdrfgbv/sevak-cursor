import { AppShell } from "@/components/layout/AppShell";
import { OpsMap } from "@/components/widgets/OpsMap";
import { tasks } from "@/lib/mock-data";
import { PriorityBadge } from "@/components/widgets/PriorityBadge";
import { Layers, Maximize2, MapPin, Radio } from "lucide-react";

const MapView = () => {
  return (
    <AppShell title="Live Operations Map" subtitle="Real-time task density and volunteer telemetry">
      <div className="p-6">
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-5">
          <div className="xl:col-span-3 bg-card border border-border rounded-xl shadow-elegant overflow-hidden">
            <div className="px-5 py-3 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 text-xs font-medium text-success">
                  <Radio className="h-3.5 w-3.5 animate-pulse" /> LIVE TELEMETRY
                </div>
                <span className="text-xs text-muted-foreground">·</span>
                <span className="text-xs text-muted-foreground tabular-nums">Last update 2s ago</span>
              </div>
              <div className="flex items-center gap-1">
                <button className="h-8 px-2.5 text-xs rounded-md bg-primary text-primary-foreground font-medium flex items-center gap-1.5"><Layers className="h-3.5 w-3.5" /> Heatmap</button>
                <button className="h-8 px-2.5 text-xs rounded-md hover:bg-muted text-muted-foreground">Clusters</button>
                <button className="h-8 px-2.5 text-xs rounded-md hover:bg-muted text-muted-foreground">Routes</button>
                <button className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground"><Maximize2 className="h-3.5 w-3.5" /></button>
              </div>
            </div>
            <div className="p-3">
              <OpsMap height="h-[640px]" />
            </div>
          </div>

          <div className="space-y-4">
            <div className="bg-card border border-border rounded-xl p-4 shadow-elegant">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Zone Telemetry</h3>
              <div className="mt-3 space-y-3">
                {[
                  { zone: "Sector 4 · Riverside", load: 92, color: "bg-danger" },
                  { zone: "Old Town", load: 78, color: "bg-warning" },
                  { zone: "Northbank", load: 54, color: "bg-primary" },
                  { zone: "Westside", load: 38, color: "bg-success" },
                ].map(z => (
                  <div key={z.zone}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-medium">{z.zone}</span>
                      <span className="tabular-nums text-muted-foreground">{z.load}% load</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className={`h-full ${z.color}`} style={{ width: `${z.load}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-card border border-border rounded-xl shadow-elegant">
              <div className="px-4 py-3 border-b border-border">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Active Pins</h3>
              </div>
              <div className="divide-y divide-border max-h-[420px] overflow-auto">
                {tasks.map(t => (
                  <div key={t.id} className="px-4 py-2.5 hover:bg-muted/40 cursor-pointer">
                    <div className="flex items-center gap-2">
                      <PriorityBadge priority={t.priority} />
                      <span className="text-[11px] font-mono text-muted-foreground">{t.id}</span>
                    </div>
                    <div className="text-xs font-medium mt-1 truncate">{t.title}</div>
                    <div className="flex items-center gap-1 text-[11px] text-muted-foreground mt-0.5">
                      <MapPin className="h-3 w-3" />{t.location}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
};

export default MapView;
