import React from "react";
import type { ToolCallWithResult } from "../../../shared/types.ts";
import { CollapsibleSection } from "../ui/CollapsibleSection.tsx";

interface ToolCallProps {
  call: ToolCallWithResult;
}

export function ToolCall({ call }: ToolCallProps) {
  const summary = getToolSummary(call);
  const mcpServer = getMcpServer(call.name);

  return (
    <div className="tool-call">
      <CollapsibleSection
        title={
          <span>
            {mcpServer && (
              <span className="tool-mcp-server">{mcpServer}</span>
            )}
            <span className="tool-call-name">
              {mcpServer ? call.name.split("__").slice(1).join("__").replace(/__/g, " > ") : call.name}
            </span>
            {summary && (
              <span className="tool-call-summary"> — {summary}</span>
            )}
            {call.isError && (
              <span className="tool-call-error"> (error)</span>
            )}
          </span>
        }
      >
        <div style={{ marginBottom: 8 }}>
          <div
            style={{
              fontSize: "0.7rem",
              fontWeight: 600,
              textTransform: "uppercase",
              color: "var(--text-muted)",
              marginBottom: 4,
            }}
          >
            Input
          </div>
          <div className="tool-call-input">
            {formatToolInput(call)}
          </div>
        </div>
        {(call.result || (call.resultImages && call.resultImages.length > 0)) && (
          <div>
            <div
              style={{
                fontSize: "0.7rem",
                fontWeight: 600,
                textTransform: "uppercase",
                color: "var(--text-muted)",
                marginBottom: 4,
              }}
            >
              Output
            </div>
            {call.result && (
              <div
                className={`tool-call-output ${call.isError ? "tool-call-error" : ""}`}
              >
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
                      alt={`Tool result image ${i + 1}`}
                    />
                  </a>
                ))}
              </div>
            )}
          </div>
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

export function getToolSummary(call: ToolCallWithResult): string {
  const input = call.input;

  // MCP tools
  if (call.name.startsWith("mcp__")) {
    const parts = call.name.split("__");
    return parts.slice(2).join(" > ") || "";
  }

  switch (call.name) {
    case "Read":
    case "Write":
    case "Edit":
      return String(input.file_path || "");
    case "Bash":
      return truncate(String(input.command || ""), 80);
    case "Glob":
      return String(input.pattern || "");
    case "Grep":
      return truncate(String(input.pattern || ""), 60);
    case "Task":
      return truncate(String(input.description || ""), 60);
    case "WebFetch":
      return truncate(String(input.url || ""), 60);
    case "WebSearch":
      return truncate(String(input.query || ""), 60);
    case "AskUserQuestion":
      if (Array.isArray(input.questions) && input.questions.length > 0) {
        const q = input.questions[0] as Record<string, unknown>;
        return truncate(String(q.question || ""), 60);
      }
      return "";
    case "Skill":
      return String(input.skill || "");
    case "TaskCreate":
      return truncate(String(input.subject || ""), 60);
    case "TaskUpdate":
      return `#${input.taskId || "?"}${input.status ? ` → ${input.status}` : ""}`;
    case "TaskList":
      return "List all tasks";
    case "TaskGet":
      return `#${input.taskId || "?"}`;
    case "TaskOutput":
      return String(input.task_id || "");
    case "TaskStop":
    case "KillShell":
      return String(input.task_id || input.shell_id || "");
    case "EnterPlanMode":
      return "Enter plan mode";
    case "ExitPlanMode":
      return "Exit plan mode";
    case "NotebookEdit":
      return String(input.notebook_path || "");
    case "NotebookRead":
      return String(input.notebook_path || "");
    case "TodoWrite":
      return truncate(String(input.subject || ""), 60);
    default:
      return "";
  }
}

export function formatToolInput(call: ToolCallWithResult): string {
  const input = call.input;

  switch (call.name) {
    case "Bash":
      return String(input.command || JSON.stringify(input, null, 2));
    case "Edit": {
      const parts: string[] = [];
      if (input.file_path) parts.push(`File: ${input.file_path}`);
      if (input.old_string) parts.push(`Replace:\n${input.old_string}`);
      if (input.new_string) parts.push(`With:\n${input.new_string}`);
      return parts.join("\n\n");
    }
    case "Read":
      return String(input.file_path || JSON.stringify(input, null, 2));
    case "Write": {
      const parts: string[] = [];
      if (input.file_path) parts.push(`File: ${input.file_path}`);
      if (input.content)
        parts.push(
          `Content:\n${truncate(String(input.content), 2000)}`
        );
      return parts.join("\n\n");
    }
    case "Glob": {
      const parts: string[] = [];
      if (input.pattern) parts.push(`Pattern: ${input.pattern}`);
      if (input.path) parts.push(`Path: ${input.path}`);
      return parts.join("\n") || JSON.stringify(input, null, 2);
    }
    case "Grep": {
      const parts: string[] = [];
      if (input.pattern) parts.push(`Pattern: ${input.pattern}`);
      if (input.path) parts.push(`Path: ${input.path}`);
      if (input.output_mode) parts.push(`Mode: ${input.output_mode}`);
      return parts.join("\n") || JSON.stringify(input, null, 2);
    }
    case "AskUserQuestion": {
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
    case "Skill": {
      const parts: string[] = [];
      if (input.skill) parts.push(`Skill: ${input.skill}`);
      if (input.args) parts.push(`Args: ${input.args}`);
      return parts.join("\n") || JSON.stringify(input, null, 2);
    }
    case "TaskCreate": {
      const parts: string[] = [];
      if (input.subject) parts.push(`Subject: ${input.subject}`);
      if (input.description) parts.push(`Description: ${input.description}`);
      return parts.join("\n") || JSON.stringify(input, null, 2);
    }
    case "TaskUpdate": {
      const parts: string[] = [];
      if (input.taskId) parts.push(`Task: #${input.taskId}`);
      if (input.status) parts.push(`Status: ${input.status}`);
      if (input.subject) parts.push(`Subject: ${input.subject}`);
      if (input.description) parts.push(`Description: ${input.description}`);
      return parts.join("\n") || JSON.stringify(input, null, 2);
    }
    case "TaskList":
    case "EnterPlanMode":
    case "ExitPlanMode":
      return Object.keys(input).length === 0 ? "(no input)" : JSON.stringify(input, null, 2);
    case "NotebookEdit": {
      const parts: string[] = [];
      if (input.notebook_path) parts.push(`Notebook: ${input.notebook_path}`);
      if (input.cell_number !== undefined) parts.push(`Cell: ${input.cell_number}`);
      if (input.edit_mode) parts.push(`Mode: ${input.edit_mode}`);
      if (input.new_source) parts.push(`Source:\n${truncate(String(input.new_source), 2000)}`);
      return parts.join("\n") || JSON.stringify(input, null, 2);
    }
    case "TodoWrite": {
      if (!Array.isArray(input.todos)) return JSON.stringify(input, null, 2);
      return (input.todos as Record<string, unknown>[])
        .map((t) => `[${t.status === "completed" ? "x" : " "}] ${t.subject || t.content || ""}`)
        .join("\n");
    }
    default:
      return JSON.stringify(input, null, 2);
  }
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max) + "...";
}

function truncateOutput(s: string): string {
  if (s.length <= 5000) return s;
  return s.slice(0, 5000) + "\n\n... (truncated)";
}
