import { describe, expect, test } from "bun:test";
import { render } from "@testing-library/react";
import { ThinkingBlock } from "./ThinkingBlock.tsx";

describe("ThinkingBlock", () => {
  test("renders thinking block container", () => {
    const { container } = render(<ThinkingBlock block={{ text: "Let me think..." }} />);
    expect(container.querySelector(".thinking-block")).not.toBeNull();
  });

  test("shows short text as-is in summary", () => {
    const text = "Short thought";
    const { container } = render(<ThinkingBlock block={{ text }} />);
    const summary = container.querySelector(".tool-call-summary");
    expect(summary!.textContent).toBe(text);
  });

  test("truncates long text with ellipsis in summary", () => {
    const text = "a".repeat(200);
    const { container } = render(<ThinkingBlock block={{ text }} />);
    const summary = container.querySelector(".tool-call-summary");
    // MAX_THINKING_PREVIEW is 100
    expect(summary!.textContent).toBe(`${"a".repeat(100)}...`);
  });

  test("text exactly at limit is not truncated", () => {
    const text = "b".repeat(100);
    const { container } = render(<ThinkingBlock block={{ text }} />);
    const summary = container.querySelector(".tool-call-summary");
    expect(summary!.textContent).toBe(text);
  });

  test("renders Thinking: label", () => {
    const { container } = render(<ThinkingBlock block={{ text: "idea" }} />);
    const header = container.querySelector(".collapsible-header");
    expect(header!.textContent).toContain("Thinking:");
  });

  test("wraps content in collapsible section", () => {
    const { container } = render(<ThinkingBlock block={{ text: "hello" }} />);
    expect(container.querySelector(".collapsible")).not.toBeNull();
  });
});
