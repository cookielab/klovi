import type React from "react";
import type { AssistantTurn } from "../../../shared/types.ts";
import { formatTimestamp } from "../../utils/time.ts";
import { MarkdownRenderer } from "../ui/MarkdownRenderer.tsx";
import { ThinkingBlock } from "./ThinkingBlock.tsx";
import { ToolCall } from "./ToolCall.tsx";

interface AssistantMessageProps {
  turn: AssistantTurn;
  visibleSubSteps?: number; // how many sub-steps to show (presentation mode)
  sessionId?: string;
  project?: string;
}

export function AssistantMessage({
  turn,
  visibleSubSteps,
  sessionId,
  project,
}: AssistantMessageProps) {
  // Build ordered sub-steps
  const subSteps: React.ReactNode[] = [];
  let key = 0;

  if (turn.thinkingBlocks.length > 0) {
    subSteps.push(
      <div key={`thinking-${key++}`}>
        {turn.thinkingBlocks.map((b, i) => (
          <ThinkingBlock key={i} block={b} />
        ))}
      </div>,
    );
  }

  if (turn.textBlocks.length > 0) {
    subSteps.push(
      <div key={`text-${key++}`}>
        {turn.textBlocks.map((text, i) => (
          <MarkdownRenderer key={i} content={text} />
        ))}
      </div>,
    );
  }

  for (const call of turn.toolCalls) {
    subSteps.push(
      <div key={`tool-${key++}`}>
        <ToolCall call={call} sessionId={sessionId} project={project} />
      </div>,
    );
  }

  const limit = visibleSubSteps !== undefined ? visibleSubSteps : subSteps.length;
  const visible = subSteps.slice(0, limit);

  return (
    <div className="message message-assistant">
      <div className="message-role">
        Assistant
        {turn.model && (
          <span style={{ fontWeight: 400, marginLeft: 8 }}>{shortModel(turn.model)}</span>
        )}
        {turn.timestamp && (
          <span className="message-timestamp">{formatTimestamp(turn.timestamp)}</span>
        )}
      </div>
      {visible.map((node, i) => (
        <div
          key={i}
          className={visibleSubSteps !== undefined && i === visible.length - 1 ? "step-enter" : ""}
        >
          {node}
        </div>
      ))}
      {turn.usage && (
        <div className="token-usage">
          {turn.usage.inputTokens.toLocaleString()} in / {turn.usage.outputTokens.toLocaleString()}{" "}
          out
          {turn.usage.cacheReadTokens && turn.usage.cacheReadTokens > 0 && (
            <span> · {turn.usage.cacheReadTokens.toLocaleString()} cache read</span>
          )}
          {turn.usage.cacheCreationTokens && turn.usage.cacheCreationTokens > 0 && (
            <span> · {turn.usage.cacheCreationTokens.toLocaleString()} cache write</span>
          )}
        </div>
      )}
    </div>
  );
}

function shortModel(model: string): string {
  if (model.includes("opus")) return "Opus";
  if (model.includes("sonnet")) return "Sonnet";
  if (model.includes("haiku")) return "Haiku";
  return model;
}
