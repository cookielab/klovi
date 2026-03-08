import { describe, expect, test } from "bun:test";
import { codexInputFormatters, codexSummaryExtractors } from "./extractors.ts";

function requireHandler(
  handlers: Record<string, (input: Record<string, unknown>) => string>,
  key: string,
): (input: Record<string, unknown>) => string {
  const handler = handlers[key];
  if (!handler) {
    throw new Error(`Missing handler: ${key}`);
  }
  return handler;
}

describe("codexSummaryExtractors", () => {
  test("command_execution summary truncates long command", () => {
    const longCommand = "x".repeat(100);
    const summary = requireHandler(
      codexSummaryExtractors,
      "command_execution",
    )({
      command: longCommand,
    });

    expect(summary.length).toBe(83);
    expect(summary.endsWith("...")).toBe(true);
  });

  test("file_change summary returns first changed path", () => {
    const summary = requireHandler(
      codexSummaryExtractors,
      "file_change",
    )({
      changes: [
        { kind: "edit", path: "src/main.ts" },
        { kind: "create", path: "src/new.ts" },
      ],
    });

    expect(summary).toBe("src/main.ts");
  });

  test("file_change summary returns empty string when changes are invalid", () => {
    expect(requireHandler(codexSummaryExtractors, "file_change")({ changes: "invalid" })).toBe("");
  });

  test("web_search summary truncates long query", () => {
    const query = "search ".repeat(20);
    const summary = requireHandler(codexSummaryExtractors, "web_search")({ query });

    expect(summary.length).toBe(63);
    expect(summary.endsWith("...")).toBe(true);
  });
});

describe("codexInputFormatters", () => {
  test("command_execution formatter returns command", () => {
    expect(requireHandler(codexInputFormatters, "command_execution")({ command: "bun test" })).toBe(
      "bun test",
    );
  });

  test("file_change formatter formats each change line", () => {
    const formatted = requireHandler(
      codexInputFormatters,
      "file_change",
    )({
      changes: [
        { kind: "edit", path: "src/main.ts" },
        { kind: "create", path: "src/new.ts" },
      ],
    });

    expect(formatted).toBe("edit: src/main.ts\ncreate: src/new.ts");
  });

  test("file_change formatter falls back to JSON when changes are not array", () => {
    const formatted = requireHandler(
      codexInputFormatters,
      "file_change",
    )({
      changes: "oops",
      id: 123,
    });
    expect(formatted).toContain('"changes": "oops"');
    expect(formatted).toContain('"id": 123');
  });

  test("web_search formatter prefixes query label", () => {
    expect(requireHandler(codexInputFormatters, "web_search")({ query: "bun test coverage" })).toBe(
      "Query: bun test coverage",
    );
  });
});
