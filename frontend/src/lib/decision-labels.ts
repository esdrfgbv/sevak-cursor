import type { Assignment, MatchResult, Task } from "@/lib/api";

export function matchLabel(score: number): string {
  if (score >= 0.85) return "High Match";
  if (score >= 0.7) return "Strong Fit";
  if (score >= 0.5) return "Good Fit";
  return "Backup Fit";
}

export function matchTags(score: number, reason?: string | null): string[] {
  const text = (reason || "").toLowerCase();
  const tags = [matchLabel(score)];
  if (text.includes("under 2") || text.includes("nearby") || text.includes("km")) tags.push("Nearby");
  if (text.includes("skill")) tags.push("Skill Fit");
  if (text.includes("available")) tags.push("Available");
  if (text.includes("reliability") || text.includes("rating")) tags.push("Reliable");
  return Array.from(new Set(tags)).slice(0, 4);
}

export function assignmentLabel(assignment: Assignment): string {
  return assignment.match_label || matchLabel(assignment.score);
}

export function resultLabel(result: MatchResult): string {
  return result.match_label || matchLabel(result.score);
}

export function priorityReason(task: Task): string {
  return task.priority_explanation || `${task.incident_type} + ${task.people_count} people affected -> ${task.priority_level.toLowerCase()} priority`;
}
