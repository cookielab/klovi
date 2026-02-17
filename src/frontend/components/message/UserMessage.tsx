import type { UserTurn } from "../../../shared/types.ts";
import { formatFullDateTime, formatTimestamp } from "../../utils/time.ts";
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
  if (turn.bashInput !== undefined) {
    return (
      <div className="status-notice bash-input-notice">
        <span className="bash-input-prompt">$</span>
        <code className="bash-input-command">{turn.bashInput}</code>
      </div>
    );
  }

  if (turn.ideOpenedFile !== undefined) {
    return (
      <div className="status-notice ide-opened-file-notice">
        Opened <code className="ide-opened-file-path">{turn.ideOpenedFile}</code>
      </div>
    );
  }

  const isStatus = STATUS_RE.test(turn.text.trim());

  if (isStatus) {
    return <div className="status-notice">{turn.text}</div>;
  }

  const isPlanMessage = turn.text.startsWith(PLAN_PREFIX);
  const showPlanLink = planSessionId && project && isPlanMessage;
  const showImplLink = implSessionId && project && !isPlanMessage;

  const role = isSubAgent ? "Root Agent" : "User";
  const badgeClass = isSubAgent ? "turn-badge-agent" : "turn-badge-user";

  return (
    <div className="turn">
      <div className="turn-header">
        <span className={`turn-badge ${badgeClass}`}>{role}</span>
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
          <time
            className="turn-timestamp"
            dateTime={turn.timestamp}
            data-tooltip={formatFullDateTime(turn.timestamp)}
          >
            {formatTimestamp(turn.timestamp)}
          </time>
        )}
      </div>
      <div className={`message ${isSubAgent ? "message-root-agent" : "message-user"}`}>
        {turn.command && (
          <div className="command-call">
            <span className="tool-skill-badge">skill</span>
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
    </div>
  );
}
