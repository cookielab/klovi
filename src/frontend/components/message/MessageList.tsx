import type { Turn } from "../../../shared/types.ts";
import { formatTimestamp } from "../../utils/time.ts";
import { MarkdownRenderer } from "../ui/MarkdownRenderer.tsx";
import { AssistantMessage } from "./AssistantMessage.tsx";
import { UserMessage } from "./UserMessage.tsx";

interface MessageListProps {
  turns: Turn[];
  visibleSubSteps?: Map<number, number>;
  sessionId?: string;
  project?: string;
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
  isSubAgent: boolean | undefined,
  planSessionId: string | undefined,
  implSessionId: string | undefined,
) {
  const activeClass = isActive ? "active-message" : "";

  switch (turn.kind) {
    case "user":
      return (
        <div key={turn.uuid || index} className={isActive ? "active-message step-enter" : ""}>
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
        <div key={turn.uuid || index} className={activeClass}>
          <AssistantMessage
            turn={turn}
            visibleSubSteps={visibleSubSteps?.get(index)}
            sessionId={sessionId}
            project={project}
          />
        </div>
      );
    case "system":
      return (
        <div key={turn.uuid || index} className={`message message-system ${activeClass}`}>
          <div className="message-role">
            System
            {turn.timestamp && (
              <span className="message-timestamp">{formatTimestamp(turn.timestamp)}</span>
            )}
          </div>
          <MarkdownRenderer content={turn.text} />
        </div>
      );
    case "parse_error":
      return (
        <div key={turn.uuid || index} className={`message message-parse-error ${activeClass}`}>
          <div className="message-role">
            Parse Error
            {turn.lineNumber > 0 && (
              <span className="parse-error-line">line {turn.lineNumber}</span>
            )}
          </div>
          <div className="parse-error-type">
            {turn.errorType === "json_parse" ? "Invalid JSON" : "Invalid Structure"}
          </div>
          {turn.errorDetails && <div className="parse-error-details">{turn.errorDetails}</div>}
          <details className="parse-error-raw">
            <summary>Raw content</summary>
            <pre>{turn.rawLine}</pre>
          </details>
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
        return renderTurn(
          turn,
          index,
          isActive,
          visibleSubSteps,
          sessionId,
          project,
          isSubAgent,
          planSessionId,
          index === firstUserTurnIndex ? implSessionId : undefined,
        );
      })}
    </div>
  );
}
