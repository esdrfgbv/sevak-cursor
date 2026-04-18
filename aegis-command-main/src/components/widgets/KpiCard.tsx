import { LucideIcon, TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface KpiProps {
  label: string;
  value: string | number;
  delta: string;
  trend: "up" | "down";
  icon: LucideIcon;
  tone?: "primary" | "success" | "danger" | "warning";
  spark?: number[];
}

const toneMap = {
  primary: { bg: "bg-primary/10", fg: "text-primary", line: "stroke-primary" },
  success: { bg: "bg-success/10", fg: "text-success", line: "stroke-success" },
  danger: { bg: "bg-danger/10", fg: "text-danger", line: "stroke-danger" },
  warning: { bg: "bg-warning/10", fg: "text-warning", line: "stroke-warning" },
};

export function KpiCard({ label, value, delta, trend, icon: Icon, tone = "primary", spark = [4,7,5,9,6,11,8,13,10,15] }: KpiProps) {
  const t = toneMap[tone];
  const max = Math.max(...spark);
  const min = Math.min(...spark);
  const points = spark.map((v, i) => {
    const x = (i / (spark.length - 1)) * 100;
    const y = 100 - ((v - min) / (max - min || 1)) * 100;
    return `${x},${y}`;
  }).join(" ");

  return (
    <div className="group relative bg-card border border-border rounded-xl p-5 shadow-elegant hover:shadow-lifted transition-all">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs font-medium text-muted-foreground tracking-wide uppercase">{label}</div>
          <div className="mt-2 text-3xl font-semibold tracking-tight tabular-nums">{value}</div>
        </div>
        <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center", t.bg)}>
          <Icon className={cn("h-4.5 w-4.5", t.fg)} />
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <div className={cn("flex items-center gap-1 text-xs font-medium", trend === "up" ? "text-success" : "text-danger")}>
          {trend === "up" ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
          {delta}
          <span className="text-muted-foreground font-normal ml-1">vs last hr</span>
        </div>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-20 h-8">
          <polyline points={points} fill="none" strokeWidth="2.5" className={cn(t.line)} strokeLinejoin="round" strokeLinecap="round" />
        </svg>
      </div>
    </div>
  );
}
