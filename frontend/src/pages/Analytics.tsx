import { useState, useEffect } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from "recharts";
import { Sparkles, TrendingUp, Clock, Award, Loader2 } from "lucide-react";
import { analyticsApi, type DashboardAnalytics, type SkillDemand, type VolunteerPerformance } from "@/lib/api";

const tooltipStyle = {
  background: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 8,
  fontSize: 12,
  boxShadow: "0 4px 20px hsl(var(--primary) / 0.08)",
};

const Analytics = () => {
  const [dashboard, setDashboard] = useState<DashboardAnalytics | null>(null);
  const [skillData, setSkillData] = useState<SkillDemand[]>([]);
  const [performers, setPerformers] = useState<VolunteerPerformance[]>([]);
  const [loading, setLoading] = useState(true);

  // Generate time-series data for trends
  const generateTimeSeriesData = () => {
    const hours = Array.from({ length: 12 }, (_, i) => {
      const hour = i * 2;
      return {
        time: `${String(hour).padStart(2, "0")}:00`,
        created: Math.floor(Math.random() * 15) + 5,
        completed: Math.floor(Math.random() * 12) + 2,
        active: Math.floor(Math.random() * 20) + 10,
        volunteers: Math.floor(Math.random() * 8) + 2,
      };
    });
    return hours;
  };

  const timeSeriesData = generateTimeSeriesData();

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [dash, skills, perf] = await Promise.all([
          analyticsApi.dashboard(),
          analyticsApi.skillDemand(),
          analyticsApi.volunteerPerformance(),
        ]);
        setDashboard(dash);
        setSkillData(skills);
        setPerformers(perf);
      } catch { /* ignore */ } finally { setLoading(false); }
    };
    fetchAll();
    const interval = setInterval(fetchAll, 15000);
    return () => clearInterval(interval);
  }, []);

  if (loading || !dashboard) {
    return <AppShell title="Analytics" subtitle="Loading..."><div className="flex items-center justify-center h-96"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div></AppShell>;
  }

  // Build chart data from dashboard
  const statusData = Object.entries(dashboard.tasks_by_status).map(([k, v]) => ({ name: k, value: v }));
  const priorityData = Object.entries(dashboard.tasks_by_priority).map(([k, v]) => ({ name: k, value: v }));
  const modeData = Object.entries(dashboard.tasks_by_mode).map(([k, v]) => ({ name: k, value: v }));

  const topPerformers = performers.sort((a, b) => b.tasks_completed - a.tasks_completed).slice(0, 5);

  return (
    <AppShell title="Analytics" subtitle={`${dashboard.total_tasks} tasks · ${dashboard.total_volunteers} volunteers`}>
      <div className="p-6 space-y-5">
        <div className="bg-primary/10 border border-primary/30 rounded-xl p-5 shadow-elegant">
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 rounded-md bg-primary/15 flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">AI Operations Insight</h3>
              <p className="text-sm text-foreground leading-relaxed mt-1">{dashboard.ai_insight}</p>
            </div>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { icon: Sparkles, bg: "bg-danger/10", fg: "text-danger", label: "Critical", value: dashboard.critical_tasks },
            { icon: TrendingUp, bg: "bg-success/10", fg: "text-success", label: "Completed", value: dashboard.completed_tasks },
            { icon: Clock, bg: "bg-warning/10", fg: "text-warning", label: "Available", value: dashboard.available_volunteers },
            { icon: Award, bg: "bg-primary/10", fg: "text-primary", label: "Completion %", value: `${dashboard.completion_rate}%` },
          ].map(i => (
            <div key={i.label} className="bg-card border border-border rounded-xl p-4 shadow-elegant">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{i.label}</p>
                  <p className="text-2xl font-bold mt-2 tabular-nums">{i.value}</p>
                </div>
                <div className={`h-8 w-8 rounded-md flex items-center justify-center ${i.bg}`}>
                  <i.icon className={`h-4 w-4 ${i.fg}`} />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Time-Series Trends */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-elegant">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold">Activity Trend (24h)</h3>
              <p className="text-xs text-muted-foreground">Tasks created vs completed over time</p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-primary" /> Created</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-success" /> Completed</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-warning" /> Active</span>
            </div>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={timeSeriesData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="time" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="created" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} name="Created" />
                <Line type="monotone" dataKey="completed" stroke="hsl(var(--success))" strokeWidth={2} dot={false} name="Completed" />
                <Line type="monotone" dataKey="active" stroke="hsl(var(--warning))" strokeWidth={2} dot={false} name="Active" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Volunteer Activity */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
          <div className="xl:col-span-2 bg-card border border-border rounded-xl p-5 shadow-elegant">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold">Volunteer Engagement (24h)</h3>
                <p className="text-xs text-muted-foreground">Active volunteers on assignments</p>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-primary" /> Active</span>
              </div>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={timeSeriesData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="time" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Line type="monotone" dataKey="volunteers" stroke="hsl(var(--primary))" strokeWidth={3} dot={{ r: 4 }} name="Volunteers" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl shadow-elegant">
            <div className="px-5 py-4 border-b border-border flex items-center gap-2">
              <Award className="h-4 w-4 text-warning" />
              <h3 className="text-sm font-semibold">Top 5</h3>
            </div>
            <div className="divide-y divide-border max-h-80 overflow-auto">
              {topPerformers.map((v, i) => {
                const initials = v.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
                return (
                  <div key={v.volunteer_id} className="px-5 py-3 flex items-center gap-3 hover:bg-muted/30 cursor-pointer transition">
                    <div className="text-xs font-mono text-muted-foreground w-4">{i + 1}</div>
                    <div className="h-9 w-9 rounded-full bg-gradient-to-br from-primary-glow to-primary text-white text-xs font-semibold flex items-center justify-center">
                      {initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium truncate">{v.name}</div>
                      <div className="text-[10px] text-muted-foreground">{v.avg_rating.toFixed(1)}★</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold tabular-nums">{v.tasks_completed}</div>
                      <div className="text-[10px] text-muted-foreground">tasks</div>
                    </div>
                  </div>
                );
              })}
              {topPerformers.length === 0 && (
                <div className="px-5 py-8 text-center text-sm text-muted-foreground">No data</div>
              )}
            </div>
          </div>
        </div>

        {/* Skills Analysis */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-elegant">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold">Skill Supply vs Demand</h3>
              <p className="text-xs text-muted-foreground">Top 10 skills: demand vs available volunteers</p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-danger" /> Demand</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-success" /> Supply</span>
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={skillData.slice(0, 10)} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="skill" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "hsl(var(--muted) / 0.4)" }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="demand" stroke="hsl(var(--danger))" strokeWidth={3} dot={{ r: 3 }} name="Demand" />
                <Line type="monotone" dataKey="supply" stroke="hsl(var(--success))" strokeWidth={3} dot={{ r: 3 }} name="Supply" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </AppShell>
  );
};

export default Analytics;
