import type { Turn } from "../../../shared/types.ts";
import { formatFullDateTime, formatTimestamp } from "../../utils/time.ts";
import { ErrorBoundary } from "../ui/ErrorBoundary.tsx";
import { MarkdownRenderer } from "../ui/MarkdownRenderer.tsx";
import { AssistantMessage } from "./AssistantMessage.tsx";
import { UserMessage } from "./UserMessage.tsx";

interface MessageListProps {
  turns: Turn[];
  visibleSubSteps?: Map<number, number>;
  sessionId?: string;
  project?: string;
  pluginId?: string;
  isSubAgent?: boolean;
  planSessionId?: string;
  implSessionId?: string;
}

function renderTurn(
  turn: Turn,
  index: number,
  isActive: boolean,
  visibleSubSteps: Map<number, number> | undefined,
  sessionId: string | undefined,
  project: string | undefined,
  pluginId: string | undefined,
  isSubAgent: boolean | undefined,
  planSessionId: string | undefined,
  implSessionId: string | undefined,
) {
  const activeClass = isActive ? "active-message" : "";

  switch (turn.kind) {
    case "user":
      return (
        <div className={isActive ? "active-message step-enter" : ""}>
          <UserMessage
            turn={turn}
            isSubAgent={isSubAgent}
            planSessionId={planSessionId}
            implSessionId={implSessionId}
            project={project}
          />
        </div>
      );
    case "assistant":
      return (
        <div className={activeClass}>
          <AssistantMessage
            turn={turn}
            visibleSubSteps={visibleSubSteps?.get(index)}
            sessionId={sessionId}
            project={project}
            pluginId={pluginId}
          />
        </div>
      );
    case "system":
      return (
        <div className={`turn ${activeClass}`}>
          <div className="turn-header">
            <span className="turn-badge turn-badge-system">System</span>
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
          <div className="message message-system">
            <MarkdownRenderer content={turn.text} />
          </div>
        </div>
      );
    case "parse_error":
      return (
        <div className={`turn ${activeClass}`}>
          <div className="turn-header">
            <span className="turn-badge turn-badge-error">Parse Error</span>
            {turn.lineNumber > 0 && (
              <span className="parse-error-line">line {turn.lineNumber}</span>
            )}
          </div>
          <div className="message message-parse-error">
            <div className="parse-error-type">
              {turn.errorType === "json_parse" ? "Invalid JSON" : "Invalid Structure"}
            </div>
            {turn.errorDetails && <div className="parse-error-details">{turn.errorDetails}</div>}
            <details className="parse-error-raw">
              <summary>Raw content</summary>
              <pre>{turn.rawLine}</pre>
            </details>
          </div>
        </div>
      );
    default:
      return null;
  }
}

const STATUS_RE = /^\[.+\]$/;

export function MessageList({
  turns,
  visibleSubSteps,
  sessionId,
  project,
  pluginId,
  isSubAgent,
  planSessionId,
  implSessionId,
}: MessageListProps) {
  const firstUserTurnIndex = turns.findIndex((t) => {
    if (t.kind !== "user") return false;
    return !STATUS_RE.test(t.text.trim());
  });

  return (
    <div className="message-list">
      {turns.map((turn, index) => {
        const isActive = visibleSubSteps ? index === turns.length - 1 : false;
        return (
          <ErrorBoundary key={turn.uuid || index} inline>
            {renderTurn(
              turn,
              index,
              isActive,
              visibleSubSteps,
              sessionId,
              project,
              pluginId,
              isSubAgent,
              planSessionId,
              index === firstUserTurnIndex ? implSessionId : undefined,
            )}
          </ErrorBoundary>
        );
      })}
    </div>
  );
}
