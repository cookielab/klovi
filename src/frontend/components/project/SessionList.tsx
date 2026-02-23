import type { Project, SessionSummary } from "../../../shared/types.ts";
import { useFetch } from "../../hooks/useFetch.ts";
import { pluginDisplayName } from "../../utils/plugin.ts";
import { formatFullDateTime, formatTime } from "../../utils/time.ts";

interface SessionListProps {
  project: Project;
  onSelect: (session: SessionSummary) => void;
  onBack: () => void;
  selectedId?: string;
}

export function SessionList({ project, onSelect, onBack, selectedId }: SessionListProps) {
  const { data, loading, error, retry } = useFetch<{ sessions: SessionSummary[] }>(
    `/api/projects/${encodeURIComponent(project.encodedPath)}/sessions`,
    [project.encodedPath],
  );

  const sessions = data?.sessions ?? [];
  const parts = project.name.split("/").filter(Boolean);
  const displayName = parts.slice(-2).join("/");

  return (
    <div>
      <div className="back-btn" onClick={onBack}>
        ← Projects
      </div>
      <div className="list-section-title">{displayName}</div>
      {loading && <div className="loading">Loading sessions...</div>}
      {error && (
        <div className="fetch-error">
          <span className="fetch-error-message">{error}</span>
          <button type="button" className="btn btn-sm" onClick={retry}>
            Retry
          </button>
        </div>
      )}
      {!loading &&
        !error &&
        sessions.map((session) => (
          <div
            key={session.sessionId}
            className={`list-item ${selectedId === session.sessionId ? "active" : ""}${session.sessionType ? ` ${session.sessionType}` : ""}`}
            onClick={() => onSelect(session)}
          >
            <div className="list-item-title">{session.firstMessage || session.slug}</div>
            <div className="list-item-meta">
              {session.pluginId && (
                <span className="plugin-badge">{pluginDisplayName(session.pluginId)}</span>
              )}{" "}
              {session.sessionType && (
                <span className={`session-type-badge ${session.sessionType}`}>
                  {session.sessionType === "plan" ? "Plan" : "Impl"}
                </span>
              )}{" "}
              <time dateTime={session.timestamp} title={formatFullDateTime(session.timestamp)}>
                {formatTime(session.timestamp)}
              </time>
            </div>
          </div>
        ))}
      {!loading && !error && sessions.length === 0 && (
        <div className="empty-list-message">No sessions found</div>
      )}
    </div>
  );
}
