import { describe, expect, test } from "bun:test";
import { render } from "@testing-library/react";
import type { ToolCallWithResult } from "../../../shared/types.ts";
import { BashToolContent } from "./BashToolContent.tsx";

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
    const codeBlock = container.querySelector(".code-block-wrapper");
    expect(codeBlock).not.toBeNull();
  });

  test("shows 'Command' label instead of 'Input'", () => {
    const { container } = render(<BashToolContent call={makeBashCall()} />);
    const labels = container.querySelectorAll(".tool-section-label");
    expect(labels[0]!.textContent).toBe("Command");
  });

  test("renders plain text output without highlighting", () => {
    const { container } = render(<BashToolContent call={makeBashCall()} />);
    expect(container.querySelector(".tool-call-output")).not.toBeNull();
  });

  test("highlights JSON output", () => {
    const call = makeBashCall({ result: '{"name": "test", "version": "1.0.0"}' });
    const { container } = render(<BashToolContent call={call} />);
    // Should have 2 code blocks: command + output
    const codeBlocks = container.querySelectorAll(".code-block-wrapper");
    expect(codeBlocks.length).toBe(2);
  });

  test("highlights diff output", () => {
    const diff = `--- a/file.ts
+++ b/file.ts
@@ -1 +1 @@
-old
+new`;
    const call = makeBashCall({ result: diff });
    const { container } = render(<BashToolContent call={call} />);
    const codeBlocks = container.querySelectorAll(".code-block-wrapper");
    expect(codeBlocks.length).toBe(2);
  });

  test("shows error styling for error output", () => {
    const call = makeBashCall({ result: "command not found", isError: true });
    const { container } = render(<BashToolContent call={call} />);
    expect(container.querySelector(".tool-call-error")).not.toBeNull();
  });

  test("error output uses plain text even if format detected", () => {
    const call = makeBashCall({
      result: '{"error": "something failed"}',
      isError: true,
    });
    const { container } = render(<BashToolContent call={call} />);
    // Should use plain text with error class, not CodeBlock
    expect(container.querySelector(".tool-call-error")).not.toBeNull();
    // Only 1 code block (the command input)
    const codeBlocks = container.querySelectorAll(".code-block-wrapper");
    expect(codeBlocks.length).toBe(1);
  });

  test("shows truncation notice for long output", () => {
    const longOutput = "x".repeat(6000);
    const call = makeBashCall({ result: longOutput });
    const { container } = render(<BashToolContent call={call} />);
    expect(container.querySelector(".tool-call-truncated")).not.toBeNull();
  });

  test("no truncation notice for short output", () => {
    const call = makeBashCall({ result: "short" });
    const { container } = render(<BashToolContent call={call} />);
    expect(container.querySelector(".tool-call-truncated")).toBeNull();
  });

  test("handles empty command", () => {
    const call = makeBashCall({ input: {} });
    const { container } = render(<BashToolContent call={call} />);
    const codeBlock = container.querySelector(".code-block-wrapper");
    expect(codeBlock).not.toBeNull();
  });

  test("handles missing result", () => {
    const call = makeBashCall({ result: "" });
    const { container } = render(<BashToolContent call={call} />);
    // Should only show command, no output section
    expect(container.querySelector(".tool-call-output")).toBeNull();
  });

  test("renders result images", () => {
    const call = makeBashCall({
      resultImages: [{ mediaType: "image/png", data: "AAAA" }],
    });
    const { container } = render(<BashToolContent call={call} />);
    const images = container.querySelectorAll(".tool-result-image");
    expect(images.length).toBe(1);
  });
});
