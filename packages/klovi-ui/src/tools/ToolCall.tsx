import { CodeBox, Collapsible } from "@cookielab.io/klovi-design-system";
import type { FrontendPlugin } from "@cookielab.io/klovi-plugin-core";
import type { ToolCallWithResult } from "../types/index.ts";
import { BashToolContent } from "./BashToolContent.tsx";
import { DiffView } from "./DiffView.tsx";
import { SmartToolOutput } from "./SmartToolOutput.tsx";
import styles from "./ToolCall.module.css";
import { formatToolInput, getToolSummary, hasInputFormatter } from "./ToolCallDefaults.ts";

function s(name: string | undefined): string {
  return name ?? "";
}

interface ToolCallProps {
  call: ToolCallWithResult;
  defaultOpen?: boolean | undefined;
  sessionId?: string | undefined;
  project?: string | undefined;
  pluginId?: string | undefined;
  getFrontendPlugin?: ((id: string) => FrontendPlugin | undefined) | undefined;
}

function isEditWithDiff(call: ToolCallWithResult): boolean {
  return (
    call.name === "Edit" &&
    typeof call.input["old_string"] === "string" &&
    typeof call.input["new_string"] === "string"
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
      <div style={{ marginBottom: 8 }}>
        <div className={s(styles["toolSectionLabel"])}>Input</div>
        {jsonInput ? (
          <CodeBox language="json">{formattedInput}</CodeBox>
        ) : (
          <div className={s(styles["toolCallInput"])}>{formattedInput}</div>
        )}
      </div>
      <SmartToolOutput
        output={call.result}
        isError={call.isError}
        resultImages={call.resultImages}
      />
    </>
  );
}

function getMcpServer(name: string): string | null {
  if (!name.startsWith("mcp__")) return null;
  const parts = name.split("__");
  return parts[1] || null;
}

function getSkillName(call: ToolCallWithResult): string | null {
  if (call.name !== "Skill") return null;
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

  const displayName = hasSubAgent
    ? "Sub-Agent"
    : mcpServer
      ? call.name.split("__").slice(1).join("__").replace(/__/g, " > ")
      : (skillName ?? call.name);

  return (
    <div className={s(styles["toolCall"])}>
      <Collapsible
        title={
          <span>
            {mcpServer && <span className={s(styles["toolMcpServer"])}>{mcpServer}</span>}
            {skillName && <span className={s(styles["toolSkillBadge"])}>skill</span>}
            <span className={s(styles["toolCallName"])}>{displayName}</span>
            {summary && !skillName && (
              <span className={s(styles["toolCallSummary"])}> — {summary}</span>
            )}
            {call.isError && <span className={s(styles["toolCallError"])}> (error)</span>}
            {hasSubAgent && (
              <a
                className={s(styles["subagentLink"])}
                href={`#/${project}/${sessionId}/subagent/${call.subAgentId}`}
                onClick={(e) => e.stopPropagation()}
              >
                Open conversation
              </a>
            )}
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
        ) : call.name === "Bash" ? (
          <BashToolContent call={call} />
        ) : (
          <DefaultToolContent
            call={call}
            pluginId={pluginId}
            getFrontendPlugin={getFrontendPluginFn}
          />
        )}
      </Collapsible>
    </div>
  );
}
