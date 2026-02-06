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
}

export function MessageList({ turns, visibleSubSteps, sessionId, project }: MessageListProps) {
  return (
    <div className="message-list">
      {turns.map((turn, index) => {
        const isLast = visibleSubSteps ? index === turns.length - 1 : false;

        switch (turn.kind) {
          case "user":
            return (
              <div
                key={turn.uuid || index}
                className={isLast && visibleSubSteps ? "step-enter" : ""}
              >
                <UserMessage turn={turn} />
              </div>
            );
          case "assistant":
            return (
              <div key={turn.uuid || index}>
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
              <div key={turn.uuid || index} className="message message-system">
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
      })}
    </div>
  );
}
