import type { UserTurn } from "../../../shared/types.ts";
import { formatTimestamp } from "../../utils/time.ts";
import { MarkdownRenderer } from "../ui/MarkdownRenderer.tsx";

interface UserMessageProps {
  turn: UserTurn;
  isSubAgent?: boolean;
  planSessionId?: string;
  implSessionId?: string;
  project?: string;
}

const STATUS_RE = /^\[.+\]$/;
const PLAN_PREFIX = "Implement the following plan";

export function UserMessage({
  turn,
  isSubAgent,
  planSessionId,
  implSessionId,
  project,
}: UserMessageProps) {
  const isStatus = STATUS_RE.test(turn.text.trim());

  if (isStatus) {
    return <div className="status-notice">{turn.text}</div>;
  }

  const isPlanMessage = turn.text.startsWith(PLAN_PREFIX);
  const showPlanLink = planSessionId && project && isPlanMessage;
  const showImplLink = implSessionId && project && !isPlanMessage;

  return (
    <div className={`message ${isSubAgent ? "message-root-agent" : "message-user"}`}>
      <div className="message-role">
        {isSubAgent ? "Root Agent" : "User"}
        {showPlanLink && (
          <a className="subagent-link" href={`#/${project}/${planSessionId}`}>
            View planning session
          </a>
        )}
        {showImplLink && (
          <a className="subagent-link" href={`#/${project}/${implSessionId}`}>
            View implementation session
          </a>
        )}
        {turn.timestamp && (
          <span className="message-timestamp">{formatTimestamp(turn.timestamp)}</span>
        )}
      </div>
      {turn.command && (
        <div className="command-call">
          <span className="command-call-label">{turn.command.name}</span>
        </div>
      )}
      <MarkdownRenderer content={turn.text} />
      {turn.attachments && turn.attachments.length > 0 && (
        <div className="attachments">
          {turn.attachments.map((a, i) => (
            <span key={i} className="attachment-badge">
              image/{a.mediaType.replace(/^image\//, "")}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
