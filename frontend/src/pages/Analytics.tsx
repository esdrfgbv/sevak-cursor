import { AppShell } from "@/components/layout/AppShell";
import { completionTrend, responseTimeData, skillDemand, volunteers } from "@/lib/mock-data";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Sparkles, TrendingUp, Clock, Award } from "lucide-react";

const tooltipStyle = {
  background: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 8,
  fontSize: 12,
  boxShadow: "0 4px 20px hsl(var(--primary) / 0.08)",
};

const Analytics = () => {
  const top = [...volunteers].sort((a, b) => b.tasksCompleted - a.tasksCompleted).slice(0, 5);

  return (
    <AppShell title="Analytics" subtitle="Operational intelligence · Last 7 days">
      <div className="p-6 space-y-5">
        {/* Insight banner */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {[
            { icon: Sparkles, bg: "bg-primary/10", fg: "text-primary", title: "Medical volunteers in shortage", body: "Demand exceeds supply by 41% in Sector 4. Recommend sourcing from Northbank pool.", action: "Auto-balance" },
            { icon: TrendingUp, bg: "bg-success/10", fg: "text-success", title: "Response time improved 28%", body: "AI-matching reduced average dispatch from 14min to 10min over 7 days.", action: "View details" },
            { icon: Clock, bg: "bg-warning/10", fg: "text-warning", title: "Peak demand window 09:00–12:00", body: "Pre-position 18 additional volunteers for tomorrow's morning shift.", action: "Schedule" },
          ].map((i) => (
            <div key={i.title} className="bg-card border border-border rounded-xl p-4 shadow-elegant">
              <div className="flex items-start gap-3">
                <div className={`h-8 w-8 rounded-md flex items-center justify-center ${i.bg}`}>
                  <i.icon className={`h-4 w-4 ${i.fg}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold leading-snug">{i.title}</h4>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{i.body}</p>
                  <button className="mt-2 text-xs font-medium text-primary hover:underline">{i.action} →</button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Charts row 1 */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
          <div className="xl:col-span-2 bg-card border border-border rounded-xl p-5 shadow-elegant">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold">Task Completion Rate</h3>
                <p className="text-xs text-muted-foreground">Opened vs completed · 7-day rolling</p>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-primary" /> Completed</span>
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-muted-foreground/40" /> Opened</span>
              </div>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={completionTrend} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="grad-c" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Area type="monotone" dataKey="opened" stroke="hsl(var(--muted-foreground))" strokeWidth={1.5} strokeDasharray="4 4" fill="transparent" />
                  <Area type="monotone" dataKey="completed" stroke="hsl(var(--primary))" strokeWidth={2.5} fill="url(#grad-c)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-5 shadow-elegant">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold">Avg Response Time</h3>
                <p className="text-xs text-muted-foreground">Minutes to first volunteer</p>
              </div>
              <span className="text-xs font-medium text-success bg-success/10 px-2 py-0.5 rounded">↓ 28%</span>
            </div>
            <div className="text-3xl font-semibold tabular-nums">10.4<span className="text-sm font-normal text-muted-foreground ml-1">min</span></div>
            <div className="h-40 mt-3">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={responseTimeData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="hour" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Line type="monotone" dataKey="min" stroke="hsl(var(--success))" strokeWidth={2.5} dot={{ r: 3, fill: "hsl(var(--success))" }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Charts row 2 */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
          <div className="xl:col-span-2 bg-card border border-border rounded-xl p-5 shadow-elegant">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold">Skill Demand vs Supply</h3>
                <p className="text-xs text-muted-foreground">Identify gaps across capability pools</p>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-primary" /> Demand</span>
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-success" /> Supply</span>
              </div>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={skillDemand} margin={{ top: 5, right: 5, left: -20, bottom: 0 }} barCategoryGap={18}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="skill" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "hsl(var(--muted) / 0.4)" }} />
                  <Bar dataKey="demand" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="supply" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl shadow-elegant">
            <div className="px-5 py-4 border-b border-border flex items-center gap-2">
              <Award className="h-4 w-4 text-warning" />
              <h3 className="text-sm font-semibold">Top Performers</h3>
            </div>
            <div className="divide-y divide-border">
              {top.map((v, i) => (
                <div key={v.id} className="px-5 py-3 flex items-center gap-3">
                  <div className="text-xs font-mono text-muted-foreground w-4">{i + 1}</div>
                  <div className="h-9 w-9 rounded-full bg-gradient-to-br from-primary-glow to-primary text-white text-xs font-semibold flex items-center justify-center">
                    {v.initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{v.name}</div>
                    <div className="text-[11px] text-muted-foreground">{v.skills[0]} · {v.reliability}% reliability</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold tabular-nums">{v.tasksCompleted}</div>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider">tasks</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
};

export default Analytics;
