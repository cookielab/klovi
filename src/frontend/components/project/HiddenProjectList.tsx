import { useEffect, useState } from "react";
import type { Project } from "../../../shared/types.ts";
import { projectDisplayName } from "../../utils/project.ts";

interface HiddenProjectListProps {
  hiddenIds: Set<string>;
  onUnhide: (encodedPath: string) => void;
  onBack: () => void;
}

export function HiddenProjectList({ hiddenIds, onUnhide, onBack }: HiddenProjectListProps) {
  const [projects, setProjects] = useState<Project[]>([]);
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

  const hidden = projects.filter((p) => hiddenIds.has(p.encodedPath));

  if (loading) return <div className="loading">Loading...</div>;

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
