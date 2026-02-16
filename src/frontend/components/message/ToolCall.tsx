import type { ToolCallWithResult } from "../../../shared/types.ts";
import { CollapsibleSection } from "../ui/CollapsibleSection.tsx";
import { DiffView } from "../ui/DiffView.tsx";

const MAX_OUTPUT_LENGTH = 5000;
const MAX_CONTENT_LENGTH = 2000;
export const MAX_THINKING_PREVIEW = 100;

interface ToolCallProps {
  call: ToolCallWithResult;
  sessionId?: string;
  project?: string;
}

function isEditWithDiff(call: ToolCallWithResult): boolean {
  return (
    call.name === "Edit" &&
    typeof call.input.old_string === "string" &&
    typeof call.input.new_string === "string"
  );
}

function DefaultToolContent({ call }: { call: ToolCallWithResult }) {
  return (
    <>
      <div style={{ marginBottom: 8 }}>
        <div className="tool-section-label">Input</div>
        <div className="tool-call-input">{formatToolInput(call)}</div>
      </div>
      {(call.result || (call.resultImages && call.resultImages.length > 0)) && (
        <div>
          <div className="tool-section-label">Output</div>
          {call.result && (
            <div className={`tool-call-output ${call.isError ? "tool-call-error" : ""}`}>
              {truncateOutput(call.result)}
            </div>
          )}
          {call.resultImages && call.resultImages.length > 0 && (
            <div className="tool-result-images">
              {call.resultImages.map((img, i) => (
                <a
                  key={i}
                  href={`data:${img.mediaType};base64,${img.data}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <img
                    className="tool-result-image"
                    src={`data:${img.mediaType};base64,${img.data}`}
                    alt={`Tool result ${i + 1}`}
                  />
                </a>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}

export function ToolCall({ call, sessionId, project }: ToolCallProps) {
  const summary = getToolSummary(call);
  const mcpServer = getMcpServer(call.name);
  const hasSubAgent = call.name === "Task" && call.subAgentId && sessionId && project;

  const displayName = hasSubAgent
    ? "Sub-Agent"
    : mcpServer
      ? call.name.split("__").slice(1).join("__").replace(/__/g, " > ")
      : call.name;

  return (
    <div className="tool-call">
      <CollapsibleSection
        title={
          <span>
            {mcpServer && <span className="tool-mcp-server">{mcpServer}</span>}
            <span className="tool-call-name">{displayName}</span>
            {summary && <span className="tool-call-summary"> — {summary}</span>}
            {call.isError && <span className="tool-call-error"> (error)</span>}
            {hasSubAgent && (
              <a
                className="subagent-link"
                href={`#/${project}/${sessionId}/subagent/${call.subAgentId}`}
                onClick={(e) => e.stopPropagation()}
              >
                Open conversation
              </a>
            )}
          </span>
        }
      >
        {isEditWithDiff(call) ? (
          <DiffView
            filePath={String(call.input.file_path || "")}
            oldString={String(call.input.old_string)}
            newString={String(call.input.new_string)}
          />
        ) : (
          <DefaultToolContent call={call} />
        )}
      </CollapsibleSection>
    </div>
  );
}

function getMcpServer(name: string): string | null {
  if (!name.startsWith("mcp__")) return null;
  const parts = name.split("__");
  return parts[1] || null;
}

type Input = Record<string, unknown>;
type SummaryExtractor = (input: Input) => string;

const SUMMARY_EXTRACTORS: Record<string, SummaryExtractor> = {
  Read: (i) => String(i.file_path || ""),
  Write: (i) => String(i.file_path || ""),
  Edit: (i) => String(i.file_path || ""),
  Bash: (i) => truncate(String(i.command || ""), 80),
  Glob: (i) => String(i.pattern || ""),
  Grep: (i) => truncate(String(i.pattern || ""), 60),
  Task: (i) => truncate(String(i.description || ""), 60),
  WebFetch: (i) => truncate(String(i.url || ""), 60),
  WebSearch: (i) => truncate(String(i.query || ""), 60),
  AskUserQuestion: (i) => getAskUserQuestionSummary(i),
  Skill: (i) => String(i.skill || ""),
  TaskCreate: (i) => truncate(String(i.subject || ""), 60),
  TaskUpdate: (i) => `#${i.taskId || "?"}${i.status ? ` → ${i.status}` : ""}`,
  TaskList: () => "List all tasks",
  TaskGet: (i) => `#${i.taskId || "?"}`,
  TaskOutput: (i) => String(i.task_id || ""),
  TaskStop: (i) => String(i.task_id || i.shell_id || ""),
  KillShell: (i) => String(i.task_id || i.shell_id || ""),
  EnterPlanMode: () => "Enter plan mode",
  ExitPlanMode: () => "Exit plan mode",
  NotebookEdit: (i) => String(i.notebook_path || ""),
  NotebookRead: (i) => String(i.notebook_path || ""),
  TodoWrite: (i) => truncate(String(i.subject || ""), 60),
};

function getAskUserQuestionSummary(input: Input): string {
  if (Array.isArray(input.questions) && input.questions.length > 0) {
    const q = input.questions[0] as Record<string, unknown>;
    return truncate(String(q.question || ""), 60);
  }
  return "";
}

export function getToolSummary(call: ToolCallWithResult): string {
  if (call.name.startsWith("mcp__")) {
    return call.name.split("__").slice(2).join(" > ") || "";
  }
  const extractor = SUMMARY_EXTRACTORS[call.name];
  return extractor ? extractor(call.input) : "";
}

type InputFormatter = (input: Input) => string;

function formatFieldParts(input: Input, fields: [string, string][], separator = "\n"): string {
  const parts: string[] = [];
  for (const [key, label] of fields) {
    if (input[key]) parts.push(`${label}: ${input[key]}`);
  }
  return parts.join(separator) || JSON.stringify(input, null, 2);
}

function formatEditInput(input: Input): string {
  const parts: string[] = [];
  if (input.file_path) parts.push(`File: ${input.file_path}`);
  if (input.old_string) parts.push(`Replace:\n${input.old_string}`);
  if (input.new_string) parts.push(`With:\n${input.new_string}`);
  return parts.join("\n\n");
}

function formatWriteInput(input: Input): string {
  const parts: string[] = [];
  if (input.file_path) parts.push(`File: ${input.file_path}`);
  if (input.content) parts.push(`Content:\n${truncate(String(input.content), MAX_CONTENT_LENGTH)}`);
  return parts.join("\n\n");
}

function formatAskUserInput(input: Input): string {
  if (!Array.isArray(input.questions)) return JSON.stringify(input, null, 2);
  return (input.questions as Record<string, unknown>[])
    .map((q, i) => {
      const lines: string[] = [];
      if (q.question) lines.push(`Q${i + 1}: ${q.question}`);
      if (Array.isArray(q.options)) {
        for (const opt of q.options as Record<string, unknown>[]) {
          lines.push(`  - ${opt.label}${opt.description ? `: ${opt.description}` : ""}`);
        }
      }
      return lines.join("\n");
    })
    .join("\n\n");
}

function formatTodoWriteInput(input: Input): string {
  if (!Array.isArray(input.todos)) return JSON.stringify(input, null, 2);
  return (input.todos as Record<string, unknown>[])
    .map((t) => `[${t.status === "completed" ? "x" : " "}] ${t.subject || t.content || ""}`)
    .join("\n");
}

function formatNotebookEditInput(input: Input): string {
  const parts: string[] = [];
  if (input.notebook_path) parts.push(`Notebook: ${input.notebook_path}`);
  if (input.cell_number !== undefined) parts.push(`Cell: ${input.cell_number}`);
  if (input.edit_mode) parts.push(`Mode: ${input.edit_mode}`);
  if (input.new_source)
    parts.push(`Source:\n${truncate(String(input.new_source), MAX_CONTENT_LENGTH)}`);
  return parts.join("\n") || JSON.stringify(input, null, 2);
}

function formatEmptyInput(input: Input): string {
  return Object.keys(input).length === 0 ? "(no input)" : JSON.stringify(input, null, 2);
}

const INPUT_FORMATTERS: Record<string, InputFormatter> = {
  Bash: (i) => String(i.command || JSON.stringify(i, null, 2)),
  Edit: formatEditInput,
  Read: (i) => String(i.file_path || JSON.stringify(i, null, 2)),
  Write: formatWriteInput,
  Glob: (i) =>
    formatFieldParts(i, [
      ["pattern", "Pattern"],
      ["path", "Path"],
    ]),
  Grep: (i) =>
    formatFieldParts(i, [
      ["pattern", "Pattern"],
      ["path", "Path"],
      ["output_mode", "Mode"],
    ]),
  AskUserQuestion: formatAskUserInput,
  Skill: (i) =>
    formatFieldParts(i, [
      ["skill", "Skill"],
      ["args", "Args"],
    ]),
  TaskCreate: (i) =>
    formatFieldParts(i, [
      ["subject", "Subject"],
      ["description", "Description"],
    ]),
  TaskUpdate: (i) => {
    const parts: string[] = [];
    if (i.taskId) parts.push(`Task: #${i.taskId}`);
    if (i.status) parts.push(`Status: ${i.status}`);
    if (i.subject) parts.push(`Subject: ${i.subject}`);
    if (i.description) parts.push(`Description: ${i.description}`);
    return parts.join("\n") || JSON.stringify(i, null, 2);
  },
  TaskList: formatEmptyInput,
  EnterPlanMode: formatEmptyInput,
  ExitPlanMode: formatEmptyInput,
  NotebookEdit: formatNotebookEditInput,
  TodoWrite: formatTodoWriteInput,
};

export function formatToolInput(call: ToolCallWithResult): string {
  const formatter = INPUT_FORMATTERS[call.name];
  return formatter ? formatter(call.input) : JSON.stringify(call.input, null, 2);
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max)}...`;
}

function truncateOutput(s: string): string {
  if (s.length <= MAX_OUTPUT_LENGTH) return s;
  return `${s.slice(0, MAX_OUTPUT_LENGTH)}\n\n... (truncated)`;
}
