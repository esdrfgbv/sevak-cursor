import { priorityColor, statusColor, type Priority, type TaskStatus } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

export function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <span className={cn("inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded ring-1", priorityColor[priority])}>
      {priority === "critical" && <span className="h-1.5 w-1.5 rounded-full bg-danger animate-blink" />}
      {priority}
    </span>
  );
}

export function StatusBadge({ status }: { status: TaskStatus }) {
  const label = status.replace("_", " ");
  return (
    <span className={cn("inline-flex items-center text-[11px] font-medium capitalize px-2 py-0.5 rounded-md", statusColor[status])}>
      {label}
    </span>
  );
}
