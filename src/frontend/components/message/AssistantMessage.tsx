import type React from "react";
import { groupContentBlocks } from "../../../shared/content-blocks.ts";
import type { AssistantTurn } from "../../../shared/types.ts";
import { shortModel } from "../../utils/model.ts";
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
  // Group consecutive non-text blocks into single steps
  const groups = groupContentBlocks(turn.contentBlocks);
  const subSteps: React.ReactNode[] = [];

  for (let g = 0; g < groups.length; g++) {
    const group = groups[g]!;
    subSteps.push(
      <div key={g}>
        {group.map((block, i) => {
          if (block.type === "thinking") {
            return <ThinkingBlock key={`thinking-${i}`} block={block.block} />;
          }
          if (block.type === "text") {
            return <MarkdownRenderer key={`text-${i}`} content={block.text} />;
          }
          return (
            <ToolCall key={`tool-${i}`} call={block.call} sessionId={sessionId} project={project} />
          );
        })}
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
