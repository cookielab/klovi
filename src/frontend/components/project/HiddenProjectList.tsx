import type { Project } from "../../../shared/types.ts";
import { useFetch } from "../../hooks/useFetch.ts";
import { projectDisplayName } from "../../utils/project.ts";

interface HiddenProjectListProps {
  hiddenIds: Set<string>;
  onUnhide: (encodedPath: string) => void;
  onBack: () => void;
}

export function HiddenProjectList({ hiddenIds, onUnhide, onBack }: HiddenProjectListProps) {
  const { data, loading, error, retry } = useFetch<{ projects: Project[] }>("/api/projects", []);

  const projects = data?.projects ?? [];
  const hidden = projects.filter((p) => hiddenIds.has(p.encodedPath));

  if (loading) return <div className="loading">Loading...</div>;
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
    <div className="hidden-projects-page">
      <div className="back-btn" onClick={onBack}>
        ← Back to projects
      </div>
      <h2 style={{ margin: "16px 0 12px", fontSize: "1.1rem", color: "var(--text-primary)" }}>
        Hidden Projects
      </h2>
      {hidden.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-title">No hidden projects</div>
          <p>Projects you hide will appear here</p>
        </div>
      ) : (
        hidden.map((project) => (
          <div key={project.encodedPath} className="list-item list-item-with-action">
            <div className="list-item-content">
              <div className="list-item-title">{projectDisplayName(project)}</div>
              <div className="list-item-meta">
                {project.sessionCount} session{project.sessionCount !== 1 ? "s" : ""}
              </div>
            </div>
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => onUnhide(project.encodedPath)}
            >
              Unhide
            </button>
          </div>
        ))
      )}
    </div>
  );
}
