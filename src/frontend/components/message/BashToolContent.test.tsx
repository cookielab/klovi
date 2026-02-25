import { afterEach, describe, expect, test } from "bun:test";
import { cleanup, render } from "@testing-library/react";
import type { ToolCallWithResult } from "../../../shared/types.ts";
import { BashToolContent } from "./BashToolContent.tsx";

afterEach(cleanup);

function makeBashCall(overrides: Partial<ToolCallWithResult> = {}): ToolCallWithResult {
  return {
    toolUseId: "test-id",
    name: "Bash",
    input: { command: "ls -la" },
    result: "file1.txt\nfile2.txt",
    isError: false,
    ...overrides,
  };
}

describe("BashToolContent", () => {
  test("renders command with syntax highlighting", () => {
    const { container } = render(<BashToolContent call={makeBashCall()} />);
    // CodeBlock/CodeBox uses pre > code for syntax highlighting
    const pre = container.querySelector("pre");
    expect(pre).not.toBeNull();
  });

  test("shows 'Command' label instead of 'Input'", () => {
    const { getByText } = render(<BashToolContent call={makeBashCall()} />);
    expect(getByText("Command")).toBeTruthy();
  });

  test("renders plain text output without highlighting", () => {
    const { container } = render(<BashToolContent call={makeBashCall()} />);
    expect(container.textContent).toContain("file1.txt");
  });

  test("highlights JSON output", () => {
    const call = makeBashCall({ result: '{"name": "test", "version": "1.0.0"}' });
    const { container } = render(<BashToolContent call={call} />);
    // Should have 2 pre elements: command + JSON output
    const preElements = container.querySelectorAll("pre");
    expect(preElements.length).toBe(2);
  });

  test("highlights diff output", () => {
    const diff = `--- a/file.ts
+++ b/file.ts
@@ -1 +1 @@
-old
+new`;
    const call = makeBashCall({ result: diff });
    const { container } = render(<BashToolContent call={call} />);
    const preElements = container.querySelectorAll("pre");
    expect(preElements.length).toBe(2);
  });

  test("shows error styling for error output", () => {
    const call = makeBashCall({ result: "command not found", isError: true });
    const { container } = render(<BashToolContent call={call} />);
    expect(container.textContent).toContain("command not found");
  });

  test("error output uses plain text even if format detected", () => {
    const call = makeBashCall({
      result: '{"error": "something failed"}',
      isError: true,
    });
    const { container } = render(<BashToolContent call={call} />);
    // Should use plain text with error, not CodeBlock
    expect(container.textContent).toContain('{"error": "something failed"}');
    // Only 1 pre element (the command input), not 2
    const preElements = container.querySelectorAll("pre");
    expect(preElements.length).toBe(1);
  });

  test("shows truncation notice for long output", () => {
    const longOutput = "x".repeat(6000);
    const call = makeBashCall({ result: longOutput });
    const { getByText } = render(<BashToolContent call={call} />);
    expect(getByText("... (truncated)")).toBeTruthy();
  });

  test("no truncation notice for short output", () => {
    const call = makeBashCall({ result: "short" });
    const { queryByText } = render(<BashToolContent call={call} />);
    expect(queryByText("... (truncated)")).toBeNull();
  });

  test("handles empty command", () => {
    const call = makeBashCall({ input: {} });
    const { container } = render(<BashToolContent call={call} />);
    // Should still render the command section with a pre element
    const pre = container.querySelector("pre");
    expect(pre).not.toBeNull();
  });

  test("handles missing result", () => {
    const call = makeBashCall({ result: "" });
    const { queryByText } = render(<BashToolContent call={call} />);
    // Should only show command, no output section
    expect(queryByText("Output")).toBeNull();
  });

  test("renders result images", () => {
    const call = makeBashCall({
      resultImages: [{ mediaType: "image/png", data: "AAAA" }],
    });
    const { getByAltText } = render(<BashToolContent call={call} />);
    expect(getByAltText("Tool result 1")).not.toBeNull();
  });
});
