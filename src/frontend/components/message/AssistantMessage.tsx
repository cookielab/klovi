import { groupContentBlocks } from "../../../shared/content-blocks.ts";
import type { AssistantTurn, ContentBlock, TokenUsage } from "../../../shared/types.ts";
import { shortModel } from "../../utils/model.ts";
import { formatFullDateTime, formatTimestamp } from "../../utils/time.ts";
import { MarkdownRenderer } from "../ui/MarkdownRenderer.tsx";
import { ThinkingBlock } from "./ThinkingBlock.tsx";
import { ToolCall } from "./ToolCall.tsx";

interface AssistantMessageProps {
  turn: AssistantTurn;
  visibleSubSteps?: number; // how many sub-steps to show (presentation mode)
  sessionId?: string;
  project?: string;
  pluginId?: string;
}

function renderGroup(
  group: ContentBlock[],
  sessionId: string | undefined,
  project: string | undefined,
  pluginId: string | undefined,
) {
  return group.map((block, i) => {
    if (block.type === "thinking") {
      return <ThinkingBlock key={`thinking-${i}`} block={block.block} />;
    }
    if (block.type === "text") {
      return <MarkdownRenderer key={`text-${i}`} content={block.text} />;
    }
    return (
      <ToolCall
        key={`tool-${block.call.toolUseId}`}
        call={block.call}
        sessionId={sessionId}
        project={project}
        pluginId={pluginId}
      />
    );
  });
}

function UsageFooter({ usage }: { usage: TokenUsage }) {
  return (
    <div className="token-usage">
      {usage.inputTokens.toLocaleString()} in / {usage.outputTokens.toLocaleString()} out
      {usage.cacheReadTokens && usage.cacheReadTokens > 0 && (
        <span> · {usage.cacheReadTokens.toLocaleString()} cache read</span>
      )}
      {usage.cacheCreationTokens && usage.cacheCreationTokens > 0 && (
        <span> · {usage.cacheCreationTokens.toLocaleString()} cache write</span>
      )}
    </div>
  );
}

export function AssistantMessage({
  turn,
  visibleSubSteps,
  sessionId,
  project,
  pluginId,
}: AssistantMessageProps) {
  const groups = groupContentBlocks(turn.contentBlocks);
  const limit = visibleSubSteps !== undefined ? visibleSubSteps : groups.length;
  const visibleGroups = groups.slice(0, limit);
  const isPresentation = visibleSubSteps !== undefined;

  // Exec-tree for turns with non-text blocks (tools, thinking)
  const hasNonText = turn.contentBlocks.some((b) => b.type !== "text");
  const firstIsText = groups.length > 0 && groups[0]?.[0]?.type === "text";

  // Split: intro text before tree, rest in tree nodes
  const introGroup = hasNonText && firstIsText ? visibleGroups[0] : null;
  const treeGroups = hasNonText ? (introGroup ? visibleGroups.slice(1) : visibleGroups) : [];
  const flatGroups = hasNonText ? [] : visibleGroups;

  return (
    <div className="turn">
      <div className="turn-header">
        <span className="turn-badge turn-badge-assistant">Assistant</span>
        {turn.model && (
          <span className="turn-badge turn-badge-model">{shortModel(turn.model)}</span>
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
      <div className="message message-assistant">
        {introGroup && (
          <div className={isPresentation && treeGroups.length === 0 ? "step-enter" : ""}>
            {renderGroup(introGroup, sessionId, project, pluginId)}
          </div>
        )}
        {treeGroups.length > 0 && (
          <div className="exec-tree">
            {treeGroups.map((group, i) => (
              <div
                key={`tree-${i}`}
                className={`tree-node${isPresentation && i === treeGroups.length - 1 ? " step-enter" : ""}`}
              >
                {renderGroup(group, sessionId, project, pluginId)}
              </div>
            ))}
          </div>
        )}
        {flatGroups.map((group, i) => (
          <div
            key={`flat-${i}`}
            className={isPresentation && i === flatGroups.length - 1 ? "step-enter" : ""}
          >
            {renderGroup(group, sessionId, project, pluginId)}
          </div>
        ))}
        {turn.usage && <UsageFooter usage={turn.usage} />}
      </div>
    </div>
  );
}
