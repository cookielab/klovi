import { describe, expect, test } from "bun:test";
import { render } from "@testing-library/react";
import { SmartToolOutput } from "./SmartToolOutput.tsx";

describe("SmartToolOutput", () => {
  test("returns null when no output and no images", () => {
    const { container } = render(<SmartToolOutput output="" isError={false} />);
    expect(container.innerHTML).toBe("");
  });

  test("renders plain text for unrecognized output", () => {
    const { container } = render(<SmartToolOutput output="file1.txt\nfile2.txt" isError={false} />);
    expect(container.querySelector(".tool-call-output")).not.toBeNull();
    expect(container.querySelector(".code-block-wrapper")).toBeNull();
  });

  test("highlights JSON output", () => {
    const { container } = render(<SmartToolOutput output='{"name": "test"}' isError={false} />);
    const codeBlocks = container.querySelectorAll(".code-block-wrapper");
    expect(codeBlocks.length).toBe(1);
  });

  test("highlights diff output", () => {
    const diff = `--- a/file.ts
+++ b/file.ts
@@ -1 +1 @@
-old
+new`;
    const { container } = render(<SmartToolOutput output={diff} isError={false} />);
    expect(container.querySelector(".code-block-wrapper")).not.toBeNull();
  });

  test("shows error styling for error output", () => {
    const { container } = render(<SmartToolOutput output="command not found" isError={true} />);
    expect(container.querySelector(".tool-call-error")).not.toBeNull();
  });

  test("error output uses plain text even if format detected", () => {
    const { container } = render(<SmartToolOutput output='{"error": "failed"}' isError={true} />);
    expect(container.querySelector(".tool-call-error")).not.toBeNull();
    expect(container.querySelector(".code-block-wrapper")).toBeNull();
  });

  test("shows truncation notice for long output", () => {
    const longOutput = "x".repeat(6000);
    const { container } = render(<SmartToolOutput output={longOutput} isError={false} />);
    expect(container.querySelector(".tool-call-truncated")).not.toBeNull();
  });

  test("no truncation notice for short output", () => {
    const { container } = render(<SmartToolOutput output="short" isError={false} />);
    expect(container.querySelector(".tool-call-truncated")).toBeNull();
  });

  test("renders result images", () => {
    const { container } = render(
      <SmartToolOutput
        output="some output"
        isError={false}
        resultImages={[{ mediaType: "image/png", data: "AAAA" }]}
      />,
    );
    const images = container.querySelectorAll(".tool-result-image");
    expect(images.length).toBe(1);
  });

  test("renders images even without text output", () => {
    const { container } = render(
      <SmartToolOutput
        output=""
        isError={false}
        resultImages={[{ mediaType: "image/png", data: "AAAA" }]}
      />,
    );
    const images = container.querySelectorAll(".tool-result-image");
    expect(images.length).toBe(1);
  });

  test("shows Output label", () => {
    const { container } = render(<SmartToolOutput output="hello" isError={false} />);
    const label = container.querySelector(".tool-section-label");
    expect(label!.textContent).toBe("Output");
  });
});
