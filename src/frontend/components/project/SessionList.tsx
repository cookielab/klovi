import type { Project, SessionSummary } from "../../../shared/types.ts";
import { useRPC } from "../../hooks/useRpc.ts";
import { getRPC } from "../../rpc.ts";
import { pluginDisplayName } from "../../utils/plugin.ts";
import { formatFullDateTime, formatTime } from "../../utils/time.ts";

interface SessionListProps {
  project: Project;
  onSelect: (session: SessionSummary) => void;
  onBack: () => void;
  selectedId?: string;
}

export function SessionList({ project, onSelect, onBack, selectedId }: SessionListProps) {
  const { data, loading, error, retry } = useRPC<{ sessions: SessionSummary[] }>(
    () => getRPC().request.getSessions({ encodedPath: project.encodedPath }),
    [project.encodedPath],
  );

  const sessions = data?.sessions ?? [];
  const parts = project.name.split("/").filter(Boolean);
  const displayName = parts.slice(-2).join("/");

  return (
    <div>
      <button type="button" className="back-btn" onClick={onBack}>
        ← Projects
      </button>
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
          <button
            type="button"
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
          </button>
        ))}
      {!loading && !error && sessions.length === 0 && (
        <div className="empty-list-message">No sessions found</div>
      )}
    </div>
  );
}
