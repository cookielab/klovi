import type { Project } from "../../shared/types.ts";

export function projectDisplayName(project: Project): string {
  // Show just the last 2 segments of the path (split on both / and \ for cross-platform)
  const parts = project.name.split(/[/\\]/).filter(Boolean);
  return parts.slice(-2).join("/");
}
