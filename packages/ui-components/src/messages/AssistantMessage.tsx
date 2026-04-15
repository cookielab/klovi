import { TurnBox } from "@cookielab.io/klovi-design-system";
import type { FrontendPlugin } from "@cookielab.io/klovi-plugin-core";
import { ToolCall } from "../tools/index.ts";
import type { AssistantTurn, ContentBlock, TokenUsage } from "../types/index.ts";
import { groupContentBlocks } from "../types/index.ts";
import { formatFullDateTime, formatTimestamp, shortModel } from "../utilities/index.ts";
import { MarkdownRenderer } from "./MarkdownRenderer.tsx";
import { ThinkingBlock } from "./ThinkingBlock.tsx";

const EXEC_TREE_CLASSES =
	"relative mt-3 pl-5 before:content-[''] before:absolute before:left-[7px] before:top-0 before:bottom-0 before:w-px before:bg-tree-line";
const TREE_NODE_CLASSES =
	"relative py-[5px] before:content-[''] before:absolute before:-left-[13px] before:top-[17px] before:w-[11px] before:h-px before:bg-tree-line last:after:content-[''] last:after:absolute last:after:-left-[14px] last:after:top-[17px] last:after:bottom-0 last:after:w-[2px] last:after:bg-surface-card";
const TOKEN_USAGE_CLASSES =
	"mt-3 pt-[10px] border-t border-border-muted font-mono text-[0.65rem] text-foreground-subtle text-right";
const STEP_ENTER_CLASSES = "animate-[stepFadeIn_0.3s_ease_forwards]";

type AssistantMessageProps = {
	turn: AssistantTurn;
	visibleSubSteps?: number | undefined;
	sessionId?: string | undefined;
	project?: string | undefined;
	pluginId?: string | undefined;
	onLinkClick?: ((url: string) => void) | undefined;
	getFrontendPlugin?: ((id: string) => FrontendPlugin | undefined) | undefined;
};

function contentBlockKey(block: ContentBlock, index: number): string {
	if (block.type === "tool_call") {
		return `tool-${block.call.toolUseId}`;
	}
	if (block.type === "thinking") {
		const thinkingKeyLength = 40;
		return `thinking-${block.block.text.slice(0, thinkingKeyLength)}-${index}`;
	}
	return `text-${index}`;
}

type RenderGroupOptions = {
	group: ContentBlock[];
	sessionId: string | undefined;
	project: string | undefined;
	pluginId: string | undefined;
	onLinkClick: ((url: string) => void) | undefined;
	getFrontendPlugin: ((id: string) => FrontendPlugin | undefined) | undefined;
};

function renderGroup(options: RenderGroupOptions) {
	return options.group.map((block, i) => {
		const key = contentBlockKey(block, i);
		if (block.type === "thinking") {
			return <ThinkingBlock key={key} block={block.block} onLinkClick={options.onLinkClick} />;
		}
		if (block.type === "text") {
			return <MarkdownRenderer key={key} content={block.text} onLinkClick={options.onLinkClick} />;
		}
		return (
			<ToolCall
				key={key}
				call={block.call}
				sessionId={options.sessionId}
				project={options.project}
				pluginId={options.pluginId}
				getFrontendPlugin={options.getFrontendPlugin}
			/>
		);
	});
}

function UsageFooter({ usage }: { usage: TokenUsage }) {
	return (
		<div className={TOKEN_USAGE_CLASSES}>
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
	const limit = visibleSubSteps ?? groups.length;
	const visibleGroups = groups.slice(0, limit);
	const isPresentation = visibleSubSteps !== undefined;

	// Exec-tree for turns with non-text blocks (tools, thinking)
	const hasNonText = turn.contentBlocks.some((b) => b.type !== "text");
	const firstIsText = groups.length > 0 && groups[0]?.[0]?.type === "text";

	// Split: intro text before tree, rest in tree nodes
	const introGroup = hasNonText && firstIsText ? visibleGroups[0] : null;
	const treeGroups = (() => {
		if (!hasNonText) {
			return [];
		}
		if (introGroup) {
			return visibleGroups.slice(1);
		}
		return visibleGroups;
	})();
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
			{introGroup ? (
				<div className={isPresentation && treeGroups.length === 0 ? STEP_ENTER_CLASSES : ""}>
					{renderGroup({
						group: introGroup,
						sessionId: sessionId,
						project: project,
						pluginId: pluginId,
						onLinkClick: onLinkClick,
						getFrontendPlugin: getFrontendPlugin,
					})}
				</div>
			) : null}
			{treeGroups.length > 0 && (
				<div className={EXEC_TREE_CLASSES}>
					{treeGroups.map((group, i) => (
						<div
							// biome-ignore lint/suspicious/noArrayIndexKey: positional groups are never reordered
							key={`tree-${i}`}
							className={`${TREE_NODE_CLASSES}${isPresentation && i === treeGroups.length - 1 ? ` ${STEP_ENTER_CLASSES}` : ""}`}
						>
							{renderGroup({
								group: group,
								sessionId: sessionId,
								project: project,
								pluginId: pluginId,
								onLinkClick: onLinkClick,
								getFrontendPlugin: getFrontendPlugin,
							})}
						</div>
					))}
				</div>
			)}
			{flatGroups.map((group, i) => (
				<div
					// biome-ignore lint/suspicious/noArrayIndexKey: positional groups are never reordered
					key={`flat-${i}`}
					className={isPresentation && i === flatGroups.length - 1 ? STEP_ENTER_CLASSES : ""}
				>
					{renderGroup({
						group: group,
						sessionId: sessionId,
						project: project,
						pluginId: pluginId,
						onLinkClick: onLinkClick,
						getFrontendPlugin: getFrontendPlugin,
					})}
				</div>
			))}
			{turn.usage ? <UsageFooter usage={turn.usage} /> : null}
		</TurnBox>
	);
}
