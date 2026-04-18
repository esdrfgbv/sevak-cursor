import { activityFeed } from "@/lib/mock-data";
import { CheckCircle2, AlertTriangle, UserPlus, Zap, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

const iconMap = {
  assign: Zap,
  alert: AlertTriangle,
  complete: CheckCircle2,
  join: UserPlus,
};

const toneMap = {
  primary: "bg-primary/10 text-primary",
  danger: "bg-danger/10 text-danger",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  muted: "bg-muted text-muted-foreground",
};

export function ActivityFeed() {
  return (
    <div className="bg-card border border-border rounded-xl shadow-elegant flex flex-col h-full">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold tracking-tight">Live Activity</h3>
          <span className="text-[10px] font-medium text-success bg-success/10 px-1.5 py-0.5 rounded">STREAMING</span>
        </div>
        <button className="text-xs text-muted-foreground hover:text-foreground">View all</button>
      </div>
      <div className="flex-1 overflow-auto divide-y divide-border">
        {activityFeed.map((item) => {
          const Icon = iconMap[item.type as keyof typeof iconMap] || Activity;
          return (
            <div key={item.id} className="px-5 py-3 flex items-start gap-3 hover:bg-muted/40 transition-colors">
              <div className={cn("h-7 w-7 rounded-md flex items-center justify-center shrink-0", toneMap[item.tone])}>
                <Icon className="h-3.5 w-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] leading-snug text-foreground">{item.text}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[11px] text-muted-foreground">{item.time}</span>
                  <span className="text-[11px] text-muted-foreground">·</span>
                  <span className="text-[11px] font-medium text-primary">{item.meta}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
