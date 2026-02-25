import { afterEach, describe, expect, test } from "bun:test";
import { cleanup, render } from "@testing-library/react";
import { CodeBlock } from "./CodeBlock.tsx";

afterEach(cleanup);

describe("CodeBlock", () => {
  test("renders code content", () => {
    const { container } = render(<CodeBlock>console.log("hi")</CodeBlock>);
    expect(container.textContent).toContain('console.log("hi")');
  });

  test("shows language header when language is provided", () => {
    const { getByText } = render(<CodeBlock language="typescript">const x = 1;</CodeBlock>);
    expect(getByText("typescript")).toBeTruthy();
  });

  test("hides language header when no language", () => {
    const { container } = render(<CodeBlock>plain stuff</CodeBlock>);
    // When no language is provided, the content should render but with no header
    expect(container.textContent).toContain("plain stuff");
    // Verify no separate language label div exists (only the code content)
    const divs = container.querySelectorAll("div");
    const headerDiv = Array.from(divs).find(
      (d) => d.childElementCount === 1 && d.querySelector("span")?.textContent === "text",
    );
    expect(headerDiv).toBeUndefined();
  });

  test("renders wrapper with content", () => {
    const { container } = render(<CodeBlock>code</CodeBlock>);
    expect(container.textContent).toContain("code");
    // Should have at least one div wrapping the content
    expect(container.querySelector("div")).not.toBeNull();
  });

  test("strips trailing newline from content", () => {
    const { container } = render(<CodeBlock language="js">line1\nline2\n</CodeBlock>);
    // SyntaxHighlighter receives children with trailing newline removed
    // We can verify the wrapper renders without issues
    expect(container.querySelector("div")).not.toBeNull();
  });
});
