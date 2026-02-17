import { useState } from "react";
import type { Project } from "../../../shared/types.ts";
import { useFetch } from "../../hooks/useFetch.ts";
import { projectDisplayName } from "../../utils/project.ts";
import { formatFullDateTime, formatRelativeTime } from "../../utils/time.ts";

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
  const { data, loading, error, retry } = useFetch<{ projects: Project[] }>("/api/projects", []);
  const [filter, setFilter] = useState("");

  const projects = data?.projects ?? [];
  const filtered = projects.filter(
    (p) =>
      !hiddenIds.has(p.encodedPath) &&
      (p.name.toLowerCase().includes(filter.toLowerCase()) ||
        p.encodedPath.toLowerCase().includes(filter.toLowerCase())),
  );

  if (loading) return <div className="loading">Loading projects...</div>;
  if (error) {
    return (
      <div className="fetch-error">
        <span className="fetch-error-message">{error}</span>
        <button type="button" className="btn btn-sm" onClick={retry}>
          Retry
        </button>
      </div>
    );
  }

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
              <time
                dateTime={project.lastActivity}
                title={formatFullDateTime(project.lastActivity)}
              >
                {formatRelativeTime(project.lastActivity)}
              </time>
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
