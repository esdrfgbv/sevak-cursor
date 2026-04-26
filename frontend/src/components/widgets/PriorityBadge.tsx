import { cn } from "@/lib/utils";

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

export function PriorityBadge({ priority }: { priority: string }) {
  const key = (priority || "").toUpperCase();
  return (
    <span className={cn("inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded ring-1", priorityColor[key] || priorityColor.LOW)}>
      {key === "CRITICAL" && <span className="h-1.5 w-1.5 rounded-full bg-danger animate-blink" />}
      {key || "LOW"}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const label = status.replace("_", " ");
  return (
    <span className={cn("inline-flex items-center text-[11px] font-medium capitalize px-2 py-0.5 rounded-md", statusColor[status] || "bg-muted text-muted-foreground")}>
      {label}
    </span>
  );
}
