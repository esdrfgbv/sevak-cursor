import { AppShell } from "@/components/layout/AppShell";
import { KpiCard } from "@/components/widgets/KpiCard";
import { GoogleMapsComponent } from "@/components/widgets/GoogleMapsComponent";
import { ActivityFeed } from "@/components/widgets/ActivityFeed";
import { Activity, AlertTriangle, CheckCircle2, Users, ArrowUpRight, Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { analyticsApi, tasksApi, type DashboardAnalytics, type Task } from "@/lib/api";

const Index = () => {
  const navigate = useNavigate();
  const [analytics, setAnalytics] = useState<DashboardAnalytics | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [insight, setInsight] = useState("");
  const [creatingTask, setCreatingTask] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const [dashData, taskData] = await Promise.all([
        analyticsApi.dashboard(),
        tasksApi.list(),
      ]);
      setAnalytics(dashData);
      setTasks(taskData);
      setInsight(dashData.ai_insight);
    } catch (err) {
      console.error("Failed to fetch dashboard data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleAutoDispatch = async () => {
    const pendingTask = tasks.find(t => t.status === "pending" && t.mode === "DISASTER");
    if (pendingTask) {
      try {
        const result = await tasksApi.match(pendingTask.id);
        toast.success(`Auto-dispatch: ${result.top_volunteers.length} volunteers matched`);
        fetchData();
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "Auto-dispatch failed");
      }
    } else {
      toast.info("No pending DISASTER tasks");
    }
  };

  const handleCreateTask = async () => {
    setCreatingTask(true);
    try {
      await tasksApi.create({
        incident_type: "Medical Emergency",
        title: "Urgent medical support needed",
        description: "Medical emergency with injured people, urgent first aid and logistics support needed for 12 people.",
        required_skills: ["Medical", "First Aid", "Logistics"],
        people_count: 12,
        lat: 17.3850 + (Math.random() - 0.5) * 0.06,
        lng: 78.4867 + (Math.random() - 0.5) * 0.06,
        mode: "DISASTER",
        image_data: null,
      });
      await fetchData();
      toast.success("New task created and AI dispatch evaluated");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Task creation failed");
    } finally {
      setCreatingTask(false);
    }
  };

  const priorityTasks = tasks
    .filter(t => t.status !== "completed")
    .sort((a, b) => b.priority_score - a.priority_score)
    .slice(0, 5);

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

  if (loading) {
    return (
      <AppShell title="Command Center" subtitle="Loading...">
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Command Center" subtitle={`${analytics?.critical_tasks || 0} 🔴 • ${analytics?.available_volunteers || 0} 🟢 • ${analytics?.completion_rate || 0}% ✓`}>
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <div className="xl:col-span-2 bg-card border border-border rounded-xl p-5 shadow-elegant">
            <div className="flex items-center gap-2 text-[11px] font-semibold tracking-wider uppercase text-muted-foreground">
              <Activity className="h-3.5 w-3.5" />
              Live Operations
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="px-2 py-1 rounded-md bg-danger/10 text-danger text-xs font-medium">{analytics?.critical_tasks || 0} critical</span>
              <span className="px-2 py-1 rounded-md bg-success/10 text-success text-xs font-medium">{analytics?.available_volunteers || 0} available</span>
              <span className="px-2 py-1 rounded-md bg-primary/10 text-primary text-xs font-medium">{analytics?.active_tasks || 0} active tasks</span>
              <span className="px-2 py-1 rounded-md bg-warning/10 text-warning text-xs font-medium">{analytics?.disaster_tasks || 0} auto-dispatch</span>
            </div>
          </div>
          <div className="bg-primary/10 border border-primary/30 rounded-xl p-5 shadow-elegant">
            <div className="flex items-center gap-2 text-[11px] font-semibold tracking-wider uppercase text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              AI Decision Insight
            </div>
            <p className="mt-2 text-sm leading-relaxed">{insight || analytics?.ai_insight}</p>
          </div>
        </div>
        {/* KPIs - All Clickable */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <div 
            onClick={() => navigate('/tasks')}
            className="cursor-pointer hover:shadow-lg transition-shadow"
          >
            <KpiCard label="Active Tasks" value={String(analytics?.active_tasks || 0)} delta={`${analytics?.disaster_tasks || 0}D / ${analytics?.ngo_tasks || 0}N`} trend="up" icon={Activity} tone="primary" spark={[8,12,10,14,11,16,13,18,15,21]} />
          </div>
          <div 
            onClick={() => navigate('/volunteers')}
            className="cursor-pointer hover:shadow-lg transition-shadow"
          >
            <KpiCard label="Available" value={String(analytics?.available_volunteers || 0)} delta={`of ${analytics?.total_volunteers || 0}`} trend="up" icon={Users} tone="success" spark={[20,22,21,25,24,28,27,30,29,33]} />
          </div>
          <div 
            onClick={() => navigate('/analytics')}
            className="cursor-pointer hover:shadow-lg transition-shadow"
          >
            <KpiCard label="Completed" value={String(analytics?.completed_tasks || 0)} delta={`${analytics?.completion_rate || 0}% rate`} trend="up" icon={CheckCircle2} tone="success" spark={[40,52,48,60,68,75,82,90,98,110]} />
          </div>
          <div 
            onClick={() => navigate('/map')}
            className="cursor-pointer hover:shadow-lg transition-shadow"
          >
            <KpiCard label="Critical" value={String(analytics?.critical_tasks || 0)} delta="HIGH + CRITICAL" trend="down" icon={AlertTriangle} tone="danger" spark={[12,11,13,10,9,8,9,7,6,6]} />
          </div>
        </div>

        {/* Map + Feed */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2 bg-card border border-border rounded-xl shadow-elegant overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold">Live Map</h3>
                <p className="text-xs text-muted-foreground">{tasks.filter(t => t.status !== 'completed').length} active</p>
              </div>
              <Button 
                size="sm" 
                variant="default"
                onClick={() => navigate('/map')}
              >
                Full Map →
              </Button>
            </div>
            <div className="p-4">
              <GoogleMapsComponent height="h-[420px]" />
            </div>
          </div>
          <div className="xl:col-span-1 h-[510px]">
            <ActivityFeed />
          </div>
        </div>

        {/* Priority tasks + Quick Actions */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2 bg-card border border-border rounded-xl shadow-elegant">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <h3 className="text-sm font-semibold">Priority Queue</h3>
              <button
                onClick={() => navigate('/tasks')}
                className="text-xs text-primary font-medium hover:underline flex items-center gap-1"
              >
                All tasks <ArrowUpRight className="h-3 w-3" />
              </button>
            </div>
            <div className="divide-y divide-border">
              {priorityTasks.length === 0 ? (
                <div className="px-5 py-8 text-center text-sm text-muted-foreground">No active tasks</div>
              ) : (
                priorityTasks.map((t) => (
                  <div key={t.id} className="px-5 py-3.5 flex items-center gap-4 hover:bg-muted/40 transition-colors group cursor-pointer"
                    onClick={() => navigate('/tasks')}
                  >
                    <span className={cn("text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full ring-1", priorityColor[t.priority_level] || priorityColor.LOW)}>
                      {t.priority_level}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-mono text-muted-foreground">T-{t.id}</span>
                        <h4 className="text-sm font-medium truncate">{t.title}</h4>
                        <span className={cn("text-[9px] font-semibold px-1.5 py-0.5 rounded uppercase",
                          t.mode === "DISASTER" ? "bg-red-500/10 text-red-500" : "bg-green-500/10 text-green-500"
                        )}>
                          {t.mode}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {t.ai_insight || t.assignments[0]?.reason || t.incident_type}
                      </div>
                    </div>
                    <div className="hidden md:flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-xs font-medium tabular-nums">{t.assignments.length}</span>
                    </div>
                    <span className={cn("text-[10px] font-semibold uppercase px-2 py-0.5 rounded", statusColor[t.status] || statusColor.pending)}>
                      {t.status}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="bg-gradient-to-br from-primary to-primary-glow text-primary-foreground rounded-xl shadow-lifted p-5 relative overflow-hidden">
            <div className="absolute inset-0 grid-bg opacity-10" />
            <div className="relative">
              <div className="flex items-center gap-2 text-[11px] font-semibold tracking-wider uppercase opacity-90">
                <Sparkles className="h-3.5 w-3.5" /> Quick Actions
              </div>
              <div className="mt-4 space-y-2">
                <Button 
                  onClick={handleCreateTask}
                  className="w-full justify-center bg-white/20 hover:bg-white/30 text-white border border-white/30"
                  variant="outline"
                  size="sm"
                  disabled={creatingTask}
                >
                  ➕ New Task
                </Button>
                <Button 
                  onClick={handleAutoDispatch}
                  className="w-full justify-center bg-white/20 hover:bg-white/30 text-white border border-white/30"
                  variant="outline"
                  size="sm"
                >
                  🤖 Auto-Dispatch
                </Button>
                <Button 
                  onClick={() => navigate('/volunteers')}
                  className="w-full justify-center bg-white/20 hover:bg-white/30 text-white border border-white/30"
                  variant="outline"
                  size="sm"
                >
                  👥 View Volunteers
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
};

export default Index;
