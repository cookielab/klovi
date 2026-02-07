import { useEffect, useState } from "react";
import type { Project, SessionSummary } from "../../../shared/types.ts";
import { shortModel } from "../../utils/model.ts";
import { formatTime } from "../../utils/time.ts";

interface SessionListProps {
  project: Project;
  onSelect: (session: SessionSummary) => void;
  onBack: () => void;
  selectedId?: string;
}

export function SessionList({ project, onSelect, onBack, selectedId }: SessionListProps) {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/projects/${encodeURIComponent(project.encodedPath)}/sessions`)
      .then((r) => r.json())
      .then((data) => {
        setSessions(data.sessions);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [project.encodedPath]);

  const parts = project.name.split("/").filter(Boolean);
  const displayName = parts.slice(-2).join("/");

  return (
    <div>
      <div className="back-btn" onClick={onBack}>
        ← Projects
      </div>
      <div className="list-section-title">{displayName}</div>
      {loading && <div className="loading">Loading sessions...</div>}
      {!loading &&
        sessions.map((session) => (
          <div
            key={session.sessionId}
            className={`list-item ${selectedId === session.sessionId ? "active" : ""}`}
            onClick={() => onSelect(session)}
          >
            <div className="list-item-title">{session.firstMessage || session.slug}</div>
            <div className="list-item-meta">
              {session.model && <span>{shortModel(session.model)} · </span>}
              {session.gitBranch && <span>{session.gitBranch} · </span>}
              {formatTime(session.timestamp)}
            </div>
          </div>
        ))}
      {!loading && sessions.length === 0 && (
        <div className="empty-list-message">No sessions found</div>
      )}
    </div>
  );
}
