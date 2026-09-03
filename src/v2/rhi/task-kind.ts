import type { TaskKind } from "./schema.js";

export function inferTaskKind(task: string): TaskKind {
  const text = task.toLowerCase();
  if (/\b(bug|repro|reproduc|failing test|stack trace|crash|debug)\b/.test(text)) return "debugging";
  if (/\b(research|survey|literature|compare sources|evidence)\b/.test(text)) return "research";
  if (/\b(architect|multi-service|system design|platform)\b/.test(text)) return "architecture";
  if (/\b(app|application|journey|crud|tracker|dashboard|ui)\b/.test(text)) return "coding";
  return "general";
}
