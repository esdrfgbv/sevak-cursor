import { AppShell } from "@/components/layout/AppShell";
import { GoogleMapsComponent } from "@/components/widgets/GoogleMapsComponent";
import { Badge } from "@/components/ui/badge";
import { MapPin, Loader2, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { tasksApi, type Task } from "@/lib/api";
import { priorityReason } from "@/lib/decision-labels";

const MapView = () => {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [creating, setCreating] = useState(false);

  const fetchTasks = async () => {
    const data = await tasksApi.list();
    setTasks(data.filter((task) => task.status !== "completed"));
  };

  useEffect(() => {
    fetchTasks().catch(console.error);
    const interval = window.setInterval(() => fetchTasks().catch(console.error), 10000);
    return () => window.clearInterval(interval);
  }, []);

  const handleCreateTask = async () => {
    setCreating(true);
    try {
      await tasksApi.create({
        incident_type: "Shelter Management",
        title: "Shelter setup coordination near primary zone",
        description: "Coordinate shelter setup and logistics for ~60 people. Volunteers will accept/decline assignments.",
        required_skills: ["Shelter Management", "Logistics", "Communications"],
        people_count: 60,
        lat: 17.3850 + (Math.random() - 0.5) * 0.04,
        lng: 78.4867 + (Math.random() - 0.5) * 0.04,
        mode: "NGO",
        image_data: null,
      });
      await fetchTasks();
      toast.success("New NGO task created");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Task creation failed");
    } finally {
      setCreating(false);
    }
  };

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
                onClick={handleCreateTask}
                size="sm"
                variant="default"
                className="text-xs h-8"
                disabled={creating}
              >
                {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "+ New Task"}
              </Button>
            </div>
            <div className="p-3">
              <GoogleMapsComponent height="h-[640px]" />
            </div>
          </div>

          <div className="space-y-4">
            <div className="bg-primary/10 border border-primary/30 rounded-xl p-4 shadow-elegant">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary mb-2">
                <Sparkles className="h-3.5 w-3.5" />
                Map Intelligence
              </div>
              <p className="text-sm leading-relaxed">
                Red markers are requests, blue markers are volunteers. Dense red clusters show where the AI should concentrate dispatch.
              </p>
            </div>

            <div className="bg-card border border-border rounded-xl p-4 shadow-elegant">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Live Priority Mix</h3>
              <div className="space-y-3">
                {[
                  { zone: "Critical", load: tasks.filter(t => t.priority_level === "CRITICAL").length, color: "bg-danger" },
                  { zone: "High", load: tasks.filter(t => t.priority_level === "HIGH").length, color: "bg-warning" },
                  { zone: "Medium", load: tasks.filter(t => t.priority_level === "MEDIUM").length, color: "bg-primary" },
                  { zone: "Low", load: tasks.filter(t => t.priority_level === "LOW").length, color: "bg-success" },
                ].map(z => (
                  <div key={z.zone} className="cursor-pointer hover:opacity-75 transition">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-medium">{z.zone}</span>
                      <span className="tabular-nums text-muted-foreground text-[11px]">{z.load}</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className={`h-full ${z.color}`} style={{ width: `${Math.min(z.load * 12, 100)}%` }} />
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
                      <Badge variant="outline" className="text-[10px]">{t.priority_level}</Badge>
                      <Badge className={`text-[10px] ${t.mode === "DISASTER" ? "bg-red-500" : "bg-blue-600"} text-white`}>
                        {t.mode === "DISASTER" ? "Auto Assigned" : "Manual Acceptance"}
                      </Badge>
                      <span className="text-[11px] font-mono text-muted-foreground">{t.id}</span>
                    </div>
                    <div className="text-xs font-medium mt-1 truncate">{t.title}</div>
                    <div className="flex items-center gap-1 text-[11px] text-muted-foreground mt-0.5">
                      <MapPin className="h-3 w-3" />{t.lat.toFixed(3)}, {t.lng.toFixed(3)}
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-1 line-clamp-2">{priorityReason(t)}</div>
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

