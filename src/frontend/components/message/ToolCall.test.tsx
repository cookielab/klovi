import { describe, expect, test } from "bun:test";
import { fireEvent, render } from "@testing-library/react";
import type { ToolCallWithResult } from "../../../shared/types.ts";
import { formatToolInput, getToolSummary, ToolCall } from "./ToolCall.tsx";

function makeCall(overrides: Partial<ToolCallWithResult>): ToolCallWithResult {
  return {
    toolUseId: "test-id",
    name: "Unknown",
    input: {},
    result: "",
    isError: false,
    ...overrides,
  };
}

describe("getToolSummary", () => {
  test("Read → file_path", () => {
    expect(getToolSummary(makeCall({ name: "Read", input: { file_path: "/src/app.ts" } }))).toBe(
      "/src/app.ts",
    );
  });

  test("Write → file_path", () => {
    expect(getToolSummary(makeCall({ name: "Write", input: { file_path: "/out.ts" } }))).toBe(
      "/out.ts",
    );
  });

  test("Edit → file_path", () => {
    expect(getToolSummary(makeCall({ name: "Edit", input: { file_path: "/edit.ts" } }))).toBe(
      "/edit.ts",
    );
  });

  test("Bash → command truncated", () => {
    const cmd = "a".repeat(100);
    const result = getToolSummary(makeCall({ name: "Bash", input: { command: cmd } }));
    expect(result.length).toBe(83); // 80 + "..."
    expect(result.endsWith("...")).toBe(true);
  });

  test("Glob → pattern", () => {
    expect(getToolSummary(makeCall({ name: "Glob", input: { pattern: "**/*.ts" } }))).toBe(
      "**/*.ts",
    );
  });

  test("Grep → pattern truncated", () => {
    expect(getToolSummary(makeCall({ name: "Grep", input: { pattern: "searchTerm" } }))).toBe(
      "searchTerm",
    );
  });

  test("Task → description truncated", () => {
    expect(getToolSummary(makeCall({ name: "Task", input: { description: "Find the bug" } }))).toBe(
      "Find the bug",
    );
  });

  test("WebFetch → url truncated", () => {
    expect(
      getToolSummary(makeCall({ name: "WebFetch", input: { url: "https://example.com" } })),
    ).toBe("https://example.com");
  });

  test("WebSearch → query truncated", () => {
    expect(getToolSummary(makeCall({ name: "WebSearch", input: { query: "bun test docs" } }))).toBe(
      "bun test docs",
    );
  });

  test("AskUserQuestion → first question text", () => {
    expect(
      getToolSummary(
        makeCall({
          name: "AskUserQuestion",
          input: {
            questions: [{ question: "Which approach?", options: [] }],
          },
        }),
      ),
    ).toBe("Which approach?");
  });

  test("Skill → skill name", () => {
    expect(getToolSummary(makeCall({ name: "Skill", input: { skill: "commit" } }))).toBe("commit");
  });

  test("TaskCreate → subject", () => {
    expect(getToolSummary(makeCall({ name: "TaskCreate", input: { subject: "Fix login" } }))).toBe(
      "Fix login",
    );
  });

  test("TaskUpdate → taskId + status", () => {
    expect(
      getToolSummary(makeCall({ name: "TaskUpdate", input: { taskId: "3", status: "completed" } })),
    ).toBe("#3 → completed");
  });

  test("TaskList → static text", () => {
    expect(getToolSummary(makeCall({ name: "TaskList", input: {} }))).toBe("List all tasks");
  });

  test("EnterPlanMode → static text", () => {
    expect(getToolSummary(makeCall({ name: "EnterPlanMode", input: {} }))).toBe("Enter plan mode");
  });

  test("ExitPlanMode → static text", () => {
    expect(getToolSummary(makeCall({ name: "ExitPlanMode", input: {} }))).toBe("Exit plan mode");
  });

  test("MCP tool → server > action", () => {
    expect(getToolSummary(makeCall({ name: "mcp__github__create_issue", input: {} }))).toBe(
      "create_issue",
    );
  });

  test("Unknown → empty string", () => {
    expect(getToolSummary(makeCall({ name: "SomeNewTool", input: {} }))).toBe("");
  });
});

describe("formatToolInput", () => {
  test("Bash → command string", () => {
    expect(formatToolInput(makeCall({ name: "Bash", input: { command: "ls -la" } }))).toBe(
      "ls -la",
    );
  });

  test("Edit → File/Replace/With format", () => {
    const result = formatToolInput(
      makeCall({
        name: "Edit",
        input: {
          file_path: "/a.ts",
          old_string: "foo",
          new_string: "bar",
        },
      }),
    );
    expect(result).toContain("File: /a.ts");
    expect(result).toContain("Replace:\nfoo");
    expect(result).toContain("With:\nbar");
  });

  test("Read → file path", () => {
    expect(formatToolInput(makeCall({ name: "Read", input: { file_path: "/b.ts" } }))).toBe(
      "/b.ts",
    );
  });

  test("Write → file + truncated content", () => {
    const result = formatToolInput(
      makeCall({
        name: "Write",
        input: { file_path: "/c.ts", content: "hello" },
      }),
    );
    expect(result).toContain("File: /c.ts");
    expect(result).toContain("Content:\nhello");
  });

  test("AskUserQuestion → formatted questions", () => {
    const result = formatToolInput(
      makeCall({
        name: "AskUserQuestion",
        input: {
          questions: [
            {
              question: "Pick a framework?",
              options: [
                { label: "React", description: "Popular" },
                { label: "Vue", description: "Progressive" },
              ],
            },
          ],
        },
      }),
    );
    expect(result).toContain("Q1: Pick a framework?");
    expect(result).toContain("- React: Popular");
    expect(result).toContain("- Vue: Progressive");
  });

  test("Default → JSON", () => {
    const result = formatToolInput(makeCall({ name: "SomeNewTool", input: { x: 1 } }));
    expect(result).toBe(JSON.stringify({ x: 1 }, null, 2));
  });
});

describe("ToolCall component", () => {
  test("error indicator shown when isError is true", () => {
    const { container } = render(
      <ToolCall
        call={makeCall({
          name: "Bash",
          input: { command: "exit 1" },
          result: "failed",
          isError: true,
        })}
      />,
    );
    const errorSpan = container.querySelector(".tool-call-error");
    expect(errorSpan).not.toBeNull();
  });

  test("image thumbnails rendered when resultImages present", () => {
    const { container } = render(
      <ToolCall
        call={makeCall({
          name: "Read",
          input: { file_path: "/img.png" },
          result: "image read",
          resultImages: [{ mediaType: "image/png", data: "AAAA" }],
        })}
      />,
    );
    // Open the collapsible first
    const header = container.querySelector(".collapsible-header")!;
    fireEvent.click(header);
    const images = container.querySelectorAll(".tool-result-image");
    expect(images.length).toBe(1);
  });
});
