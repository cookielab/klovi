import { useEffect, useState } from "react";
import type { Project } from "../../../shared/types.ts";
import { projectDisplayName } from "../../utils/project.ts";
import { formatRelativeTime } from "../../utils/time.ts";

interface ProjectListProps {
  onSelect: (project: Project) => void;
  selected?: string;
  hiddenIds: Set<string>;
  onHide: (encodedPath: string) => void;
  onShowHidden: () => void;
}

export function ProjectList({
  onSelect,
  selected,
  hiddenIds,
  onHide,
  onShowHidden,
}: ProjectListProps) {
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
      !hiddenIds.has(p.encodedPath) &&
      (p.name.toLowerCase().includes(filter.toLowerCase()) ||
        p.encodedPath.toLowerCase().includes(filter.toLowerCase())),
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
          className={`list-item list-item-with-action ${selected === project.encodedPath ? "active" : ""}`}
          onClick={() => onSelect(project)}
        >
          <div className="list-item-content">
            <div className="list-item-title">{projectDisplayName(project)}</div>
            <div className="list-item-meta">
              {project.sessionCount} session{project.sessionCount !== 1 ? "s" : ""}
              {" · "}
              {formatRelativeTime(project.lastActivity)}
            </div>
          </div>
          <button
            type="button"
            className="btn-hide"
            title="Hide project"
            onClick={(e) => {
              e.stopPropagation();
              onHide(project.encodedPath);
            }}
          >
            ×
          </button>
        </div>
      ))}
      {filtered.length === 0 && <div className="empty-list-message">No projects found</div>}
      {hiddenIds.size > 0 && (
        <div className="hidden-projects-link" onClick={onShowHidden}>
          {hiddenIds.size} hidden project{hiddenIds.size !== 1 ? "s" : ""}
        </div>
      )}
    </div>
  );
}
