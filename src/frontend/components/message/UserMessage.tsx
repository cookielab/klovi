import React from "react";
import type { UserTurn } from "../../../shared/types.ts";
import { MarkdownRenderer } from "../ui/MarkdownRenderer.tsx";

interface UserMessageProps {
  turn: UserTurn;
}

export function UserMessage({ turn }: UserMessageProps) {
  return (
    <div className="message message-user">
      <div className="message-role">User</div>
      {turn.command && (
        <div className="command-call">
          <span className="command-call-label">{turn.command.name}</span>
        </div>
      )}
      <MarkdownRenderer content={turn.text} />
    </div>
  );
}
