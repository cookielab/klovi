import { useEffect, useState } from "react";
import type { Project } from "../../../shared/types.ts";

interface ProjectListProps {
  onSelect: (project: Project) => void;
  selected?: string;
}

export function ProjectList({ onSelect, selected }: ProjectListProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then((data) => {
        setProjects(data.projects);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const filtered = projects.filter(
    (p) =>
      p.name.toLowerCase().includes(filter.toLowerCase()) ||
      p.encodedPath.toLowerCase().includes(filter.toLowerCase()),
  );

  if (loading) return <div className="loading">Loading projects...</div>;

  return (
    <div>
      <input
        className="filter-input"
        placeholder="Filter projects..."
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      />
      <div className="list-section-title">Projects ({filtered.length})</div>
      {filtered.map((project) => (
        <div
          key={project.encodedPath}
          className={`list-item ${selected === project.encodedPath ? "active" : ""}`}
          onClick={() => onSelect(project)}
        >
          <div className="list-item-title">{projectDisplayName(project)}</div>
          <div className="list-item-meta">
            {project.sessionCount} session{project.sessionCount !== 1 ? "s" : ""}
            {" · "}
            {formatRelativeTime(project.lastActivity)}
          </div>
        </div>
      ))}
      {filtered.length === 0 && (
        <div
          style={{
            padding: "20px",
            textAlign: "center",
            color: "var(--text-muted)",
            fontSize: "0.85rem",
          }}
        >
          No projects found
        </div>
      )}
    </div>
  );
}

function projectDisplayName(project: Project): string {
  // Show just the last 2 segments of the path
  const parts = project.name.split("/").filter(Boolean);
  return parts.slice(-2).join("/");
}

function formatRelativeTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 30) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}
