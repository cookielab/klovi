import { afterEach, describe, expect, test } from "bun:test";
import { cleanup, render } from "@testing-library/react";
import { ThinkingBlock } from "./ThinkingBlock.tsx";

afterEach(cleanup);

describe("ThinkingBlock", () => {
  test("renders thinking block container", () => {
    const { container } = render(<ThinkingBlock block={{ text: "Let me think..." }} />);
    expect(container.querySelector("div")).not.toBeNull();
  });

  test("shows short text as-is in summary", () => {
    const text = "Short thought";
    const { container } = render(<ThinkingBlock block={{ text }} />);
    expect(container.textContent).toContain(text);
  });

  test("truncates long text with ellipsis in summary", () => {
    const text = "a".repeat(200);
    const { container } = render(<ThinkingBlock block={{ text }} />);
    // MAX_THINKING_PREVIEW is 100, the button/header text should show truncated version
    expect(container.textContent).toContain(`${"a".repeat(100)}...`);
  });

  test("text exactly at limit is not truncated", () => {
    const text = "b".repeat(100);
    const { container } = render(<ThinkingBlock block={{ text }} />);
    expect(container.textContent).toContain(text);
    expect(container.textContent).not.toContain(`${text}...`);
  });

  test("renders Thinking: label", () => {
    const { getByRole } = render(<ThinkingBlock block={{ text: "idea" }} />);
    const header = getByRole("button");
    expect(header.textContent).toContain("Thinking:");
  });

  test("wraps content in collapsible section", () => {
    const { getByRole } = render(<ThinkingBlock block={{ text: "hello" }} />);
    // Collapsible renders a button for the header
    expect(getByRole("button")).not.toBeNull();
  });
});
