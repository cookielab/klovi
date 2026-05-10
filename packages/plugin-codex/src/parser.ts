import type {
	AssistantTurn,
	ContentBlock,
	Session,
	TokenUsage,
	ToolCallWithResult,
	Turn,
	UserTurn,
} from "@cookielab.io/klovi-plugin-core";
import { epochSecondsToIso } from "@cookielab.io/klovi-plugin-core";
import { Effect } from "effect";
import { type CodexSessionMeta, findCodexSessionFileById, normalizeSessionMeta } from "./session-index";
import { readFileText } from "./shared/discovery-utils";
import { iterateJsonl } from "./shared/jsonl-utils";

type CodexItemCommand = {
	type: "command_execution";
	command: string;
	["aggregated_output"]?: string;
	["exit_code"]?: number;
};

type CodexItemFileChange = {
	type: "file_change";
	changes: { path: string; kind: string }[];
};

type CodexItemMcp = {
	type: "mcp_tool_call";
	server: string;
	tool: string;
	arguments: Record<string, unknown>;
	result?: string;
};

type CodexItemWebSearch = {
	type: "web_search";
	query: string;
};

type CodexItemAgentMessage = {
	type: "agent_message";
	text: string;
};

type CodexItemReasoning = {
	type: "reasoning";
	text: string;
};

type CodexItem =
	| CodexItemCommand
	| CodexItemFileChange
	| CodexItemMcp
	| CodexItemWebSearch
	| CodexItemAgentMessage
	| CodexItemReasoning;

type CodexEvent = {
	type: string;
	item?: CodexItem | undefined;
	text?: string | undefined;
	callId?: string | undefined;
	toolName?: string | undefined;
	toolInput?: Record<string, unknown> | undefined;
	usage?:
		| {
				["input_tokens"]?: number | undefined;
				["cached_input_tokens"]?: number | undefined;
				["output_tokens"]?: number | undefined;
		  }
		| undefined;
};

type EnvelopePayload = {
	type?: string;
	message?: string;
	text?: string;
	name?: string;
	["call_id"]?: string;
	input?: string;
	output?: string;
	arguments?: Record<string, unknown> | string;
	role?: string;
	content?: { type: string; text?: string }[];
	["input_tokens"]?: number;
	["cached_input_tokens"]?: number;
	["output_tokens"]?: number;
	info?: {
		["last_token_usage"]?: {
			["input_tokens"]?: number;
			["cached_input_tokens"]?: number;
			["output_tokens"]?: number;
		};
	} | null;
	[key: string]: unknown;
};

type EnvelopeEvent = {
	type: string;
	timestamp?: string;
	payload?: EnvelopePayload;
};

function isKnownModel(model: string | null | undefined): model is string {
	return typeof model === "string" && model.length > 0 && model !== "unknown";
}

function resolveCodexModel(metaInfo: CodexSessionMeta | null, turnContextModel: string | null): string {
	if (isKnownModel(metaInfo?.model)) {
		return metaInfo.model;
	}
	if (isKnownModel(turnContextModel)) {
		return turnContextModel;
	}
	if (isKnownModel(metaInfo?.provider_id)) {
		return metaInfo.provider_id;
	}
	return "unknown";
}

function extractTurnContextModel(parsed: unknown): string | null {
	if (typeof parsed !== "object" || parsed === null) {
		return null;
	}
	const event = parsed as { type?: unknown; payload?: { model?: unknown } };
	if (event.type !== "turn_context") {
		return null;
	}
	return typeof event.payload?.model === "string" ? event.payload.model : null;
}

function normalizeEventMsg(payload: EnvelopePayload): CodexEvent | null {
	switch (payload.type) {
		case "task_started":
			return { type: "turn.started" };
		case "user_message":
			return { type: "user_message", text: payload.message ?? payload.text ?? "" };
		case "agent_message":
			return {
				type: "item.completed",
				item: { type: "agent_message", text: payload.message ?? payload.text ?? "" },
			};
		case "agent_reasoning":
			return {
				type: "item.completed",
				item: { type: "reasoning", text: payload.text ?? "" },
			};
		case "token_count": {
			const src = payload.info?.last_token_usage ?? payload;
			return {
				type: "usage_update",
				usage: {
					["input_tokens"]: src.input_tokens,
					["cached_input_tokens"]: src.cached_input_tokens,
					["output_tokens"]: src.output_tokens,
				},
			};
		}
		case "task_complete":
			return { type: "turn.completed" };
		default:
			return null;
	}
}

function parseArguments(args: Record<string, unknown> | string | undefined): Record<string, unknown> {
	if (!args) {
		return {};
	}
	if (typeof args === "string") {
		try {
			return JSON.parse(args) as Record<string, unknown>;
		} catch {
			return { raw: args };
		}
	}
	return args;
}

function normalizeResponseItem(payload: EnvelopePayload): CodexEvent | null {
	if (payload.type === "function_call" || payload.type === "custom_tool_call") {
		const name = payload.name ?? "unknown";
		const args = parseArguments(payload.arguments);
		return {
			type: "item.completed",
			item: {
				type: "command_execution",
				command: name,
				["aggregated_output"]: "",
				["exit_code"]: 0,
			},
			// Store call_id and parsed args for the generic tool call path
			callId: payload.call_id,
			toolName: name,
			toolInput: args,
		};
	}
	if (payload.type === "function_call_output" || payload.type === "custom_tool_call_output") {
		return {
			type: "tool_output",
			callId: payload.call_id,
			text: payload.output ?? "",
		};
	}
	return null;
}

const OLD_FORMAT_TYPES = new Set(["turn.started", "turn.completed", "item.completed", "thread.started"]);

function normalizeEvent(raw: unknown): CodexEvent | null {
	if (typeof raw !== "object" || raw === null || !("type" in raw)) {
		return null;
	}
	const obj = raw as EnvelopeEvent;

	if (OLD_FORMAT_TYPES.has(obj.type)) {
		return raw as CodexEvent;
	}

	const { payload } = obj;
	if (!payload) {
		return null;
	}

	if (obj.type === "event_msg") {
		return normalizeEventMsg(payload);
	}
	if (obj.type === "response_item") {
		return normalizeResponseItem(payload);
	}
	return null;
}

function buildToolCallFromItem(item: CodexItem, nextToolUseId: () => string): ToolCallWithResult | null {
	switch (item.type) {
		case "command_execution":
			return {
				toolUseId: nextToolUseId(),
				name: "command_execution",
				input: { command: item.command },
				result: item.aggregated_output ?? "",
				isError: item.exit_code !== undefined && item.exit_code !== 0,
			};
		case "file_change":
			return {
				toolUseId: nextToolUseId(),
				name: "file_change",
				input: { changes: item.changes },
				result: "",
				isError: false,
			};
		case "mcp_tool_call":
			return {
				toolUseId: nextToolUseId(),
				name: item.tool,
				input: item.arguments,
				result: item.result ?? "",
				isError: false,
			};
		case "web_search":
			return {
				toolUseId: nextToolUseId(),
				name: "web_search",
				input: { query: item.query },
				result: "",
				isError: false,
			};
		default:
			return null;
	}
}

function createUserTurn(text: string, timestamp: string, uuid: string): UserTurn {
	return {
		kind: "user",
		uuid: uuid,
		timestamp: timestamp,
		text: text,
	};
}

function createAssistantTurn(model: string, timestamp: string, uuid: string): AssistantTurn {
	return {
		kind: "assistant",
		uuid: uuid,
		timestamp: timestamp,
		model: model,
		contentBlocks: [],
	};
}

function itemToContentBlock(item: CodexItem, nextToolUseId: () => string): ContentBlock | null {
	if (item.type === "agent_message") {
		return { type: "text", text: item.text };
	}
	if (item.type === "reasoning") {
		return { type: "thinking", block: { text: item.text } };
	}
	const toolCall = buildToolCallFromItem(item, nextToolUseId);
	if (toolCall) {
		return { type: "tool_call", call: toolCall };
	}
	return null;
}

function handleTurnStarted(
	state: TurnBuilderState,
	event: CodexEvent,
	timestamp: string,
	nextUserTurnId: () => string,
): void {
	flushAssistant(state);
	state.turnCount += 1;
	if (state.turnCount > 1) {
		state.turns.push(createUserTurn(event.text ?? "", timestamp, nextUserTurnId()));
	}
}

function handleTurnCompleted(state: TurnBuilderState, event: CodexEvent): void {
	if (state.currentAssistant && event.usage) {
		const usage: TokenUsage = {
			inputTokens: event.usage.input_tokens ?? 0,
			outputTokens: event.usage.output_tokens ?? 0,
			cacheReadTokens: event.usage.cached_input_tokens,
		};
		state.currentAssistant.usage = usage;
	}
	flushAssistant(state);
}

type TurnBuilderContext = {
	model: string;
	timestamp: string;
	nextToolUseId: () => string;
	nextUserTurnId: () => string;
	nextAssistantTurnId: () => string;
};

function handleItemCompleted(state: TurnBuilderState, event: CodexEvent, ctx: TurnBuilderContext): void {
	if (!event.item) {
		return;
	}

	if (!state.currentAssistant) {
		state.currentAssistant = createAssistantTurn(ctx.model, ctx.timestamp, ctx.nextAssistantTurnId());
	}

	const block = itemToContentBlock(event.item, ctx.nextToolUseId);
	if (block) {
		state.currentAssistant.contentBlocks.push(block);
	}
}

function flushAssistant(state: TurnBuilderState): void {
	if (state.currentAssistant && state.currentAssistant.contentBlocks.length > 0) {
		state.turns.push(state.currentAssistant);
	}
	state.currentAssistant = null;
}

type TurnBuilderState = {
	turns: Turn[];
	currentAssistant: AssistantTurn | null;
	turnCount: number;
	/** Maps call_id → ToolCallWithResult for new-format function_call_output matching */
	pendingToolCalls: Map<string, ToolCallWithResult>;
};

function handleUserMessage(state: TurnBuilderState, event: CodexEvent): void {
	// Find the last user turn and set its text
	for (let i = state.turns.length - 1; i >= 0; i--) {
		const turn = state.turns[i];
		if (!turn) {
			continue;
		}
		if (turn.kind === "user" && !turn.text) {
			turn.text = event.text ?? "";
			return;
		}
	}
	// If no user turn yet (first message), create one
	if (state.turnCount === 0) {
		state.turnCount += 1;
	}
	state.turns.push(createUserTurn(event.text ?? "", "", "codex-user-first"));
}

function handleUsageUpdate(state: TurnBuilderState, event: CodexEvent): void {
	if (state.currentAssistant && event.usage) {
		const usage: TokenUsage = {
			inputTokens: event.usage.input_tokens ?? 0,
			outputTokens: event.usage.output_tokens ?? 0,
			cacheReadTokens: event.usage.cached_input_tokens,
		};
		state.currentAssistant.usage = usage;
	}
}

function handleToolOutput(state: TurnBuilderState, event: CodexEvent): void {
	if (!event.callId) {
		return;
	}
	const toolCall = state.pendingToolCalls.get(event.callId);
	if (toolCall) {
		toolCall.result = event.text ?? "";
	}
}

function handleGenericToolCall(state: TurnBuilderState, event: CodexEvent, ctx: TurnBuilderContext): void {
	if (!state.currentAssistant) {
		state.currentAssistant = createAssistantTurn(ctx.model, ctx.timestamp, ctx.nextAssistantTurnId());
	}
	const toolCall: ToolCallWithResult = {
		toolUseId: event.callId ?? ctx.nextToolUseId(),
		name: event.toolName ?? "unknown",
		input: event.toolInput ?? {},
		result: "",
		isError: false,
	};
	if (event.callId) {
		state.pendingToolCalls.set(event.callId, toolCall);
	}
	state.currentAssistant.contentBlocks.push({ type: "tool_call", call: toolCall });
}

function dispatchEvent(state: TurnBuilderState, event: CodexEvent, ctx: TurnBuilderContext): void {
	switch (event.type) {
		case "turn.started":
			handleTurnStarted(state, event, ctx.timestamp, ctx.nextUserTurnId);
			break;
		case "turn.completed":
			handleTurnCompleted(state, event);
			break;
		case "item.completed":
			if (event.toolName) {
				handleGenericToolCall(state, event, ctx);
			} else {
				handleItemCompleted(state, event, ctx);
			}
			break;
		case "usage_update":
			handleUsageUpdate(state, event);
			break;
		case "user_message":
			handleUserMessage(state, event);
			break;
		case "tool_output":
			handleToolOutput(state, event);
			break;
		default:
			break;
	}
}

function buildCodexTurns(events: CodexEvent[], model: string, timestamp: string): Turn[] {
	let toolUseCounter = 0;
	let userTurnCounter = 0;
	let assistantTurnCounter = 0;

	const nextToolUseId = () => {
		toolUseCounter += 1;
		return `codex-tool-${toolUseCounter}`;
	};
	const nextUserTurnId = () => {
		userTurnCounter += 1;
		return `codex-user-${userTurnCounter}`;
	};
	const nextAssistantTurnId = () => {
		assistantTurnCounter += 1;
		return `codex-assistant-${assistantTurnCounter}`;
	};

	const state: TurnBuilderState = {
		turns: [],
		currentAssistant: null,
		turnCount: 0,
		pendingToolCalls: new Map(),
	};

	const ctx: TurnBuilderContext = {
		model: model,
		timestamp: timestamp,
		nextToolUseId: nextToolUseId,
		nextUserTurnId: nextUserTurnId,
		nextAssistantTurnId: nextAssistantTurnId,
	};

	for (const event of events) {
		dispatchEvent(state, event, ctx);
	}

	flushAssistant(state);
	return state.turns;
}

function loadCodexSession(_nativeId: string, sessionId: string) {
	return Effect.gen(function* () {
		const filePath = yield* findCodexSessionFileById(sessionId);
		if (!filePath) {
			return {
				sessionId: sessionId,
				project: _nativeId,
				turns: [],
				pluginId: "codex-cli",
			} as Session;
		}

		const text = yield* readFileText(filePath);

		let meta: unknown = null;
		const events: CodexEvent[] = [];
		let turnContextModel: string | null = null;

		iterateJsonl(text, ({ parsed, lineIndex }) => {
			if (lineIndex === 0) {
				const normalized = normalizeSessionMeta(parsed);
				if (normalized) {
					meta = normalized;
					return;
				}
			}

			if (!isKnownModel(turnContextModel)) {
				const extracted = extractTurnContextModel(parsed);
				if (isKnownModel(extracted)) {
					turnContextModel = extracted;
				}
			}

			const event = normalizeEvent(parsed);
			if (event) {
				events.push(event);
			}
		});

		const metaInfo = normalizeSessionMeta(meta);
		const model = resolveCodexModel(metaInfo, turnContextModel);
		const timestamp = metaInfo ? epochSecondsToIso(metaInfo.timestamps.created) : "";

		const turns = buildCodexTurns(events, model, timestamp);

		return {
			sessionId: sessionId,
			project: _nativeId,
			turns: turns,
			pluginId: "codex-cli",
		} as Session;
	});
}

export type { CodexEvent };
export { buildCodexTurns, loadCodexSession };
