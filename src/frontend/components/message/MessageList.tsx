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
    default:
      return null;
  }
}

export function MessageList({
  turns,
  visibleSubSteps,
  sessionId,
  project,
  isSubAgent,
  planSessionId,
}: MessageListProps) {
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
        );
      })}
    </div>
  );
}
