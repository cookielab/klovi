import { TurnBox } from "@cookielab.io/klovi-design-system";
import type { FrontendPlugin } from "@cookielab.io/klovi-plugin-core";
import { ToolCall } from "../tools/index.ts";
import type { AssistantTurn, ContentBlock, TokenUsage } from "../types/index.ts";
import { groupContentBlocks } from "../types/index.ts";
import { formatFullDateTime, formatTimestamp, shortModel } from "../utilities/index.ts";
import styles from "./AssistantMessage.module.css";
import { MarkdownRenderer } from "./MarkdownRenderer.tsx";
import { ThinkingBlock } from "./ThinkingBlock.tsx";

function s(name: string | undefined): string {
  return name ?? "";
}

interface AssistantMessageProps {
  turn: AssistantTurn;
  visibleSubSteps?: number | undefined;
  sessionId?: string | undefined;
  project?: string | undefined;
  pluginId?: string | undefined;
  onLinkClick?: ((url: string) => void) | undefined;
  getFrontendPlugin?: ((id: string) => FrontendPlugin | undefined) | undefined;
}

function contentBlockKey(block: ContentBlock, index: number): string {
  if (block.type === "tool_call") return `tool-${block.call.toolUseId}`;
  if (block.type === "thinking") return `thinking-${block.block.text.slice(0, 40)}-${index}`;
  return `text-${index}`;
}

function renderGroup(
  group: ContentBlock[],
  sessionId: string | undefined,
  project: string | undefined,
  pluginId: string | undefined,
  onLinkClick: ((url: string) => void) | undefined,
  getFrontendPlugin: ((id: string) => FrontendPlugin | undefined) | undefined,
) {
  return group.map((block, i) => {
    const key = contentBlockKey(block, i);
    if (block.type === "thinking") {
      return <ThinkingBlock key={key} block={block.block} onLinkClick={onLinkClick} />;
    }
    if (block.type === "text") {
      return <MarkdownRenderer key={key} content={block.text} onLinkClick={onLinkClick} />;
    }
    return (
      <ToolCall
        key={key}
        call={block.call}
        sessionId={sessionId}
        project={project}
        pluginId={pluginId}
        getFrontendPlugin={getFrontendPlugin}
      />
    );
  });
}

function UsageFooter({ usage }: { usage: TokenUsage }) {
  return (
    <div className={s(styles["tokenUsage"])}>
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
  onLinkClick,
  getFrontendPlugin,
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
    // biome-ignore lint/a11y/useValidAriaRole: role is a component prop, not HTML role
    <TurnBox
      role="assistant"
      {...(turn.model ? { model: shortModel(turn.model) } : {})}
      {...(turn.timestamp
        ? {
            timestamp: (
              <time dateTime={turn.timestamp} data-tooltip={formatFullDateTime(turn.timestamp)}>
                {formatTimestamp(turn.timestamp)}
              </time>
            ),
          }
        : {})}
    >
      {introGroup && (
        <div className={isPresentation && treeGroups.length === 0 ? s(styles["stepEnter"]) : ""}>
          {renderGroup(introGroup, sessionId, project, pluginId, onLinkClick, getFrontendPlugin)}
        </div>
      )}
      {treeGroups.length > 0 && (
        <div className={s(styles["execTree"])}>
          {treeGroups.map((group, i) => (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: positional groups are never reordered
              key={`tree-${i}`}
              className={`${s(styles["treeNode"])}${isPresentation && i === treeGroups.length - 1 ? ` ${s(styles["stepEnter"])}` : ""}`}
            >
              {renderGroup(group, sessionId, project, pluginId, onLinkClick, getFrontendPlugin)}
            </div>
          ))}
        </div>
      )}
      {flatGroups.map((group, i) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: positional groups are never reordered
          key={`flat-${i}`}
          className={isPresentation && i === flatGroups.length - 1 ? s(styles["stepEnter"]) : ""}
        >
          {renderGroup(group, sessionId, project, pluginId, onLinkClick, getFrontendPlugin)}
        </div>
      ))}
      {turn.usage && <UsageFooter usage={turn.usage} />}
    </TurnBox>
  );
}
