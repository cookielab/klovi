import React from "react";
import type { Turn } from "../../../shared/types.ts";
import { UserMessage } from "./UserMessage.tsx";
import { AssistantMessage } from "./AssistantMessage.tsx";
import { MarkdownRenderer } from "../ui/MarkdownRenderer.tsx";

interface MessageListProps {
  turns: Turn[];
  visibleSubSteps?: Map<number, number>;
}

export function MessageList({ turns, visibleSubSteps }: MessageListProps) {
  return (
    <div className="message-list">
      {turns.map((turn, index) => {
        const isLast = visibleSubSteps
          ? index === turns.length - 1
          : false;

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
                />
              </div>
            );
          case "system":
            return (
              <div key={turn.uuid || index} className="message message-system">
                <div className="message-role">System</div>
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
