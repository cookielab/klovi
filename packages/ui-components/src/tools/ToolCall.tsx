import { CodeBox, Collapsible, Text } from "@cookielab.io/klovi-design-system";
import type { FrontendPlugin } from "@cookielab.io/klovi-plugin-core";
import type React from "react";
import type { ToolCallWithResult } from "../types/index";
import { BashToolContent } from "./BashToolContent";
import { DiffView } from "./DiffView";
import { SmartToolOutput } from "./SmartToolOutput";
import { formatToolInput, getToolSummary, hasInputFormatter } from "./ToolCallDefaults";


const T_INPUT = "Input";
const T_SKILL = "skill";
const T_TEXT = "—";
const T_SP_1 = " ";
const T_ERROR = "(error)";
const T_OPEN_CONVERSATION = "Open conversation";

const SECTION_LABEL_CLASSES = "mb-1 text-[0.7rem] font-semibold text-foreground-subtle uppercase";
const INPUT_CLASSES = "font-mono text-[0.78rem] leading-[1.5] whitespace-pre-wrap break-words text-foreground-muted";
const MCP_BADGE_CLASSES =
	"mr-[6px] inline-block px-[6px] py-px bg-surface-sunken text-[0.7rem] font-semibold text-foreground-subtle uppercase tracking-[0.03em]";
const SKILL_BADGE_CLASSES =
	"mr-[6px] inline-block px-[6px] py-px bg-accent-subtle text-[0.7rem] font-semibold text-accent uppercase tracking-[0.03em]";
const TOOL_NAME_CLASSES = "font-semibold text-role-tool text-[0.82rem]";
const TOOL_SUMMARY_CLASSES = "font-mono text-[0.78rem] text-foreground-subtle";
const SUBAGENT_LINK_CLASSES =
	"ml-[10px] font-[inherit] text-[0.75rem] font-medium text-accent no-underline opacity-80 hover:underline hover:opacity-100";

function stopPropagation(e: React.MouseEvent): void {
	e.stopPropagation();
}

type ToolCallProps = {
	call: ToolCallWithResult;
	defaultOpen?: boolean | undefined;
	sessionId?: string | undefined;
	project?: string | undefined;
	pluginId?: string | undefined;
	getFrontendPlugin?: ((id: string) => FrontendPlugin | undefined) | undefined;
};

function isEditWithDiff(call: ToolCallWithResult): boolean {
	return (
		call.name === "Edit" && typeof call.input["old_string"] === "string" && typeof call.input["new_string"] === "string"
	);
}

function DefaultToolContent({
	call,
	pluginId,
	getFrontendPlugin: getFrontendPluginFn,
}: {
	call: ToolCallWithResult;
	pluginId?: string | undefined;
	getFrontendPlugin?: ((id: string) => FrontendPlugin | undefined) | undefined;
}) {
	const formattedInput = formatToolInput(call, getFrontendPluginFn, pluginId);
	const jsonInput = !hasInputFormatter(call, getFrontendPluginFn, pluginId);

	return (
		<>
			<div className="mb-2">
				<div className={SECTION_LABEL_CLASSES}><Text>{T_INPUT}</Text></div>
				{jsonInput ? (
					<CodeBox language="json">{formattedInput}</CodeBox>
				) : (
					<div className={INPUT_CLASSES}>{formattedInput}</div>
				)}
			</div>
			<SmartToolOutput output={call.result} isError={call.isError} resultImages={call.resultImages} />
		</>
	);
}

function ToolContentBody({
	call,
	pluginId,
	getFrontendPlugin: getFrontendPluginFn,
}: {
	call: ToolCallWithResult;
	pluginId?: string | undefined;
	getFrontendPlugin?: ((id: string) => FrontendPlugin | undefined) | undefined;
}) {
	if (call.name === "Bash") {
		return <BashToolContent call={call} />;
	}
	return <DefaultToolContent call={call} pluginId={pluginId} getFrontendPlugin={getFrontendPluginFn} />;
}

function getMcpServer(name: string): string | null {
	if (!name.startsWith("mcp__")) {
		return null;
	}
	const parts = name.split("__");
	return parts[1] || null;
}

function getSkillName(call: ToolCallWithResult): string | null {
	if (call.name !== "Skill") {
		return null;
	}
	return String(call.input["skill"] || "") || null;
}

export function ToolCall({
	call,
	defaultOpen,
	sessionId,
	project,
	pluginId,
	getFrontendPlugin: getFrontendPluginFn,
}: ToolCallProps) {
	const summary = getToolSummary(call, getFrontendPluginFn, pluginId);
	const mcpServer = getMcpServer(call.name);
	const skillName = getSkillName(call);
	const hasSubAgent = call.name === "Task" && call.subAgentId && sessionId && project;

	const displayName = (() => {
		if (hasSubAgent) {
			return "Sub-Agent";
		}
		if (mcpServer) {
			return call.name.split("__").slice(1).join("__").replace(/__/gu, " > ");
		}
		return skillName ?? call.name;
	})();

	return (
		<div className="my-[2px]">
			<Collapsible
				title={
					<span>
						{mcpServer ? <span className={MCP_BADGE_CLASSES}>{mcpServer}</span> : null}
						{skillName ? <span className={SKILL_BADGE_CLASSES}><Text>{T_SKILL}</Text></span> : null}
						<span className={TOOL_NAME_CLASSES}>{displayName}</span>
						{summary && !skillName ? <span className={TOOL_SUMMARY_CLASSES}><Text>{T_SP_1}</Text><Text>{T_TEXT}</Text><Text>{T_SP_1}</Text>{summary}</span> : null}
						{call.isError ? <span className="text-error"><Text>{T_SP_1}</Text><Text>{T_ERROR}</Text></span> : null}
						{hasSubAgent ? (
							<a
								className={SUBAGENT_LINK_CLASSES}
								href={`#/${project}/${sessionId}/subagent/${call.subAgentId}`}
								onClick={stopPropagation}
							>
								<Text>{T_OPEN_CONVERSATION}</Text>
							</a>
						) : null}
					</span>
				}
				defaultOpen={defaultOpen}
			>
				{isEditWithDiff(call) ? (
					<DiffView
						filePath={String(call.input["file_path"] || "")}
						oldString={String(call.input["old_string"])}
						newString={String(call.input["new_string"])}
					/>
				) : (
					<ToolContentBody call={call} pluginId={pluginId} getFrontendPlugin={getFrontendPluginFn} />
				)}
			</Collapsible>
		</div>
	);
}
