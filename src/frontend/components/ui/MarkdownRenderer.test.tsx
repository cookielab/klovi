import { afterEach, describe, expect, test } from "bun:test";
import { cleanup, render } from "@testing-library/react";
import { MarkdownRenderer } from "./MarkdownRenderer.tsx";

afterEach(cleanup);

describe("MarkdownRenderer", () => {
  test("renders plain text", () => {
    const { container } = render(<MarkdownRenderer content="Hello world" />);
    expect(container.textContent).toContain("Hello world");
  });

  test("renders markdown bold", () => {
    const { container } = render(<MarkdownRenderer content="Hello **bold** world" />);
    const strong = container.querySelector("strong");
    expect(strong).not.toBeNull();
    expect(strong?.textContent).toBe("bold");
  });

  test("renders external links with onClick handler", () => {
    const { container } = render(
      <MarkdownRenderer content="Visit [example](https://example.com)" />,
    );
    const link = container.querySelector("a");
    expect(link).not.toBeNull();
    expect(link?.getAttribute("href")).toBe("https://example.com");
    // External links use onClick to open via Electrobun's openExternal RPC
    expect(link?.onclick).not.toBeNull();
  });

  test("renders file references with @", () => {
    const { container } = render(<MarkdownRenderer content="See @src/utils/time.ts for details" />);
    const code = container.querySelector("code");
    expect(code).not.toBeNull();
    expect(code?.textContent).toBe("@src/utils/time.ts");
  });

  test("renders inline code", () => {
    const { container } = render(<MarkdownRenderer content="Use `const x = 1`" />);
    const code = container.querySelector("code");
    expect(code).not.toBeNull();
  });

  test("wraps in a container div", () => {
    const { container } = render(<MarkdownRenderer content="test" />);
    expect(container.querySelector("div")).not.toBeNull();
  });

  test("renders fenced code blocks", () => {
    // biome-ignore lint/security/noSecrets: test data, not a real secret
    const content = "```js\nconsole.log('hi')\n```";
    const { container } = render(<MarkdownRenderer content={content} />);
    // Should render through CodeBox component — check for pre element
    expect(container.querySelector("pre")).not.toBeNull();
  });

  test("renders GFM tables", () => {
    const content = "| A | B |\n|---|---|\n| 1 | 2 |";
    const { container } = render(<MarkdownRenderer content={content} />);
    const table = container.querySelector("table");
    expect(table).not.toBeNull();
  });
});
