import { AppShell } from "@/components/layout/AppShell";
import { GoogleMapsComponent } from "@/components/widgets/GoogleMapsComponent";
import { tasks } from "@/lib/mock-data";
import { PriorityBadge } from "@/components/widgets/PriorityBadge";
import { MapPin } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

const MapView = () => {
  const navigate = useNavigate();

  return (
    <AppShell title="Live Operations Map" subtitle="Real-time task density and volunteer telemetry">
      <div className="p-6">
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-5">
          <div className="xl:col-span-3 bg-card border border-border rounded-xl shadow-elegant overflow-hidden">
            <div className="px-5 py-3 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 text-xs font-medium text-success">
                  <span className="h-2 w-2 rounded-full bg-success animate-pulse" /> LIVE MAP
                </div>
                <span className="text-xs text-muted-foreground">·</span>
                <span className="text-xs text-muted-foreground tabular-nums">{tasks.length} tasks active</span>
              </div>
              <Button
                onClick={() => navigate("/request")}
                size="sm"
                variant="default"
                className="text-xs h-8"
              >
                + New Task
              </Button>
            </div>
            <div className="p-3">
              <GoogleMapsComponent height="h-[640px]" />
            </div>
          </div>

          <div className="space-y-4">
            <div className="bg-card border border-border rounded-xl p-4 shadow-elegant">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Zone Activity</h3>
              <div className="space-y-3">
                {[
                  { zone: "Sector 4", load: 92, color: "bg-danger" },
                  { zone: "Old Town", load: 78, color: "bg-warning" },
                  { zone: "Northbank", load: 54, color: "bg-primary" },
                  { zone: "Westside", load: 38, color: "bg-success" },
                ].map(z => (
                  <div key={z.zone} className="cursor-pointer hover:opacity-75 transition">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-medium">{z.zone}</span>
                      <span className="tabular-nums text-muted-foreground text-[11px]">{z.load}%</span>
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
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Active Tasks</h3>
              </div>
              <div className="divide-y divide-border max-h-[420px] overflow-auto">
                {tasks.map(t => (
                  <div 
                    key={t.id} 
                    className="px-4 py-2.5 hover:bg-muted/40 cursor-pointer transition"
                    onClick={() => navigate(`/tasks?id=${t.id}`)}
                  >
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

