import React from "react";
import type { ToolCallWithResult } from "../../../shared/types.ts";
import { CollapsibleSection } from "../ui/CollapsibleSection.tsx";

interface ToolCallProps {
  call: ToolCallWithResult;
}

export function ToolCall({ call }: ToolCallProps) {
  const summary = getToolSummary(call);

  return (
    <div className="tool-call">
      <CollapsibleSection
        title={
          <span>
            <span className="tool-call-name">{call.name}</span>
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
        {call.result && (
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
            <div
              className={`tool-call-output ${call.isError ? "tool-call-error" : ""}`}
            >
              {truncateOutput(call.result)}
            </div>
          </div>
        )}
      </CollapsibleSection>
    </div>
  );
}

function getToolSummary(call: ToolCallWithResult): string {
  const input = call.input;
  switch (call.name) {
    case "Read":
      return String(input.file_path || "");
    case "Write":
      return String(input.file_path || "");
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
    default:
      return "";
  }
}

function formatToolInput(call: ToolCallWithResult): string {
  const input = call.input;

  // Special formatting for common tools
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
