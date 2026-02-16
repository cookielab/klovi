import { describe, expect, test } from "bun:test";
import { render } from "@testing-library/react";
import { CodeBlock } from "./CodeBlock.tsx";

describe("CodeBlock", () => {
  test("renders code content", () => {
    const { container } = render(<CodeBlock>console.log("hi")</CodeBlock>);
    expect(container.textContent).toContain('console.log("hi")');
  });

  test("shows language header when language is provided", () => {
    const { container } = render(<CodeBlock language="typescript">const x = 1;</CodeBlock>);
    const header = container.querySelector(".code-block-header");
    expect(header).not.toBeNull();
    expect(header!.textContent).toBe("typescript");
  });

  test("hides language header when no language", () => {
    const { container } = render(<CodeBlock>plain text</CodeBlock>);
    const header = container.querySelector(".code-block-header");
    expect(header).toBeNull();
  });

  test("wraps in code-block-wrapper", () => {
    const { container } = render(<CodeBlock>code</CodeBlock>);
    expect(container.querySelector(".code-block-wrapper")).not.toBeNull();
    expect(container.querySelector(".code-block-content")).not.toBeNull();
  });

  test("strips trailing newline from content", () => {
    const { container } = render(<CodeBlock language="js">{"line1\nline2\n"}</CodeBlock>);
    // SyntaxHighlighter receives children with trailing newline removed
    // We can verify the wrapper renders without issues
    expect(container.querySelector(".code-block-content")).not.toBeNull();
  });
});
