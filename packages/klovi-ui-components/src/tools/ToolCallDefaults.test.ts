import { describe, expect, test } from "bun:test";
import type { FrontendPlugin } from "@cookielab.io/klovi-plugin-core";
import type { ToolCallWithResult } from "../types/index.ts";
import {
  formatToolInput,
  getToolSummary,
  hasInputFormatter,
  MAX_OUTPUT_LENGTH,
  truncateOutput,
} from "./ToolCallDefaults.ts";

function call(name: string, input: Record<string, unknown> = {}): ToolCallWithResult {
  return {
    toolUseId: "tool-1",
    name,
    input,
    result: "",
    isError: false,
  };
}

function createFrontendPlugin(): FrontendPlugin {
  return {
    id: "test-plugin",
    displayName: "Test Plugin",
    summaryExtractors: {
      CustomTool: (input) => `summary:${String(input["k"] ?? "")}`,
    },
    inputFormatters: {
      CustomTool: (input) => `input:${String(input["k"] ?? "")}`,
    },
  };
}

describe("truncateOutput", () => {
  test("returns output unchanged when under limit", () => {
    expect(truncateOutput("short")).toBe("short");
  });

  test("truncates output at MAX_OUTPUT_LENGTH", () => {
    const long = "x".repeat(MAX_OUTPUT_LENGTH + 10);
    const truncated = truncateOutput(long);

    expect(truncated.length).toBe(MAX_OUTPUT_LENGTH);
    expect(truncated).toBe(long.slice(0, MAX_OUTPUT_LENGTH));
  });
});

describe("getToolSummary", () => {
  test("uses plugin summary extractor when provided", () => {
    const plugin = createFrontendPlugin();
    const getPlugin = (id: string) => (id === plugin.id ? plugin : undefined);

    expect(getToolSummary(call("CustomTool", { k: "v" }), getPlugin, plugin.id)).toBe("summary:v");
  });

  test("falls back to built-in extractors", () => {
    expect(getToolSummary(call("Read", { file_path: "/tmp/file.ts" }))).toBe("/tmp/file.ts");
    expect(getToolSummary(call("TaskUpdate", { taskId: 7, status: "done" }))).toBe("#7 → done");
    expect(
      getToolSummary(call("AskUserQuestion", { questions: [{ question: "What now?" }] })),
    ).toBe("What now?");
  });

  test("formats mcp tool names", () => {
    expect(getToolSummary(call("mcp__filesystem__read_file"))).toBe("read_file");
    expect(getToolSummary(call("mcp__filesystem"))).toBe("");
  });

  test("returns empty string for unknown tool", () => {
    expect(getToolSummary(call("UnknownTool"))).toBe("");
  });
});

describe("hasInputFormatter", () => {
  test("reports true for built-in formatters", () => {
    expect(hasInputFormatter(call("Edit"))).toBe(true);
    expect(hasInputFormatter(call("TaskList"))).toBe(true);
    expect(hasInputFormatter(call("AskUserQuestion"))).toBe(true);
  });

  test("reports true for plugin formatter", () => {
    const plugin = createFrontendPlugin();
    const getPlugin = (id: string) => (id === plugin.id ? plugin : undefined);

    expect(hasInputFormatter(call("CustomTool"), getPlugin, plugin.id)).toBe(true);
  });

  test("reports false for unknown tools", () => {
    expect(hasInputFormatter(call("NoFormatter"))).toBe(false);
  });
});

describe("formatToolInput", () => {
  test("uses plugin formatter when available", () => {
    const plugin = createFrontendPlugin();
    const getPlugin = (id: string) => (id === plugin.id ? plugin : undefined);

    expect(formatToolInput(call("CustomTool", { k: "v" }), getPlugin, plugin.id)).toBe("input:v");
  });

  test("formats edit and write inputs with labeled sections", () => {
    const editText = formatToolInput(
      call("Edit", {
        file_path: "/tmp/a.ts",
        old_string: "before",
        new_string: "after",
      }),
    );

    expect(editText).toContain("File: /tmp/a.ts");
    expect(editText).toContain("Replace:\nbefore");
    expect(editText).toContain("With:\nafter");

    const writeText = formatToolInput(
      call("Write", {
        file_path: "/tmp/b.ts",
        content: "x".repeat(2050),
      }),
    );

    expect(writeText).toContain("File: /tmp/b.ts");
    expect(writeText).toContain("Content:\n");
    expect(writeText).toContain("...");
  });

  test("formats AskUserQuestion prompts and options", () => {
    const text = formatToolInput(
      call("AskUserQuestion", {
        questions: [
          {
            question: "Pick one",
            options: [{ label: "A", description: "alpha" }, { label: "B" }],
          },
        ],
      }),
    );

    expect(text).toContain("Q1: Pick one");
    expect(text).toContain("- A: alpha");
    expect(text).toContain("- B");
  });

  test("falls back to JSON when AskUserQuestion payload is invalid", () => {
    const text = formatToolInput(call("AskUserQuestion", { questions: "bad" }));
    expect(text).toContain('"questions": "bad"');
  });

  test("formats TodoWrite checklist and fallback subject/content", () => {
    const text = formatToolInput(
      call("TodoWrite", {
        todos: [
          { status: "completed", subject: "done item" },
          { status: "pending", content: "next item" },
        ],
      }),
    );

    expect(text).toContain("[x] done item");
    expect(text).toContain("[ ] next item");
  });

  test("TaskList uses empty input sentinel", () => {
    expect(formatToolInput(call("TaskList", {}))).toBe("(no input)");
    expect(formatToolInput(call("TaskList", { filter: "open" }))).toContain('"filter": "open"');
  });

  test("NotebookEdit includes notebook metadata and source", () => {
    const text = formatToolInput(
      call("NotebookEdit", {
        notebook_path: "/tmp/demo.ipynb",
        cell_number: 2,
        edit_mode: "replace",
        // biome-ignore lint/security/noSecrets: notebook source fixture for formatter test
        new_source: "print('hello')",
      }),
    );

    expect(text).toContain("Notebook: /tmp/demo.ipynb");
    expect(text).toContain("Cell: 2");
    expect(text).toContain("Mode: replace");
    // biome-ignore lint/security/noSecrets: assertion against fixture output
    expect(text).toContain("Source:\nprint('hello')");
  });

  test("falls back to JSON for unknown tools", () => {
    const text = formatToolInput(call("Unknown", { a: 1 }));
    expect(text).toContain('"a": 1');
  });
});
