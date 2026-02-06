import { test, expect, describe } from "bun:test";
import React from "react";
import { render } from "@testing-library/react";
import { AssistantMessage } from "./AssistantMessage.tsx";
import type { AssistantTurn } from "../../../shared/types.ts";

function makeTurn(overrides: Partial<AssistantTurn> = {}): AssistantTurn {
  return {
    kind: "assistant",
    uuid: "a1",
    timestamp: "2024-01-15T10:00:00Z",
    model: "claude-sonnet-4-5-20250929",
    thinkingBlocks: [],
    textBlocks: [],
    toolCalls: [],
    ...overrides,
  };
}

describe("AssistantMessage", () => {
  test("model name display — Opus", () => {
    const { container } = render(
      <AssistantMessage turn={makeTurn({ model: "claude-opus-4-6" })} />
    );
    const role = container.querySelector(".message-role");
    expect(role!.textContent).toContain("Opus");
  });

  test("model name display — Sonnet", () => {
    const { container } = render(
      <AssistantMessage turn={makeTurn({ model: "claude-sonnet-4-5-20250929" })} />
    );
    const role = container.querySelector(".message-role");
    expect(role!.textContent).toContain("Sonnet");
  });

  test("model name display — Haiku", () => {
    const { container } = render(
      <AssistantMessage turn={makeTurn({ model: "claude-haiku-4-5-20251001" })} />
    );
    const role = container.querySelector(".message-role");
    expect(role!.textContent).toContain("Haiku");
  });

  test("token usage footer displayed when usage exists", () => {
    const { container } = render(
      <AssistantMessage
        turn={makeTurn({
          textBlocks: ["Hello"],
          usage: {
            inputTokens: 1500,
            outputTokens: 300,
            cacheReadTokens: 1200,
            cacheCreationTokens: 100,
          },
        })}
      />
    );
    const usage = container.querySelector(".token-usage");
    expect(usage).not.toBeNull();
    expect(usage!.textContent).toContain("1,500 in");
    expect(usage!.textContent).toContain("300 out");
    expect(usage!.textContent).toContain("1,200 cache read");
    expect(usage!.textContent).toContain("100 cache write");
  });

  test("token usage footer hidden when no usage", () => {
    const { container } = render(
      <AssistantMessage turn={makeTurn({ textBlocks: ["Hello"] })} />
    );
    const usage = container.querySelector(".token-usage");
    expect(usage).toBeNull();
  });

  test("thinking blocks rendered", () => {
    const { container } = render(
      <AssistantMessage
        turn={makeTurn({
          thinkingBlocks: [{ text: "Let me think..." }],
        })}
      />
    );
    const thinking = container.querySelector(".thinking-block");
    expect(thinking).not.toBeNull();
  });

  test("text blocks rendered as markdown", () => {
    const { container } = render(
      <AssistantMessage
        turn={makeTurn({
          textBlocks: ["Hello **bold** world"],
        })}
      />
    );
    const content = container.querySelector(".markdown-content");
    expect(content).not.toBeNull();
  });

  test("tool calls rendered", () => {
    const { container } = render(
      <AssistantMessage
        turn={makeTurn({
          toolCalls: [
            {
              toolUseId: "t1",
              name: "Bash",
              input: { command: "ls" },
              result: "file.ts",
              isError: false,
            },
          ],
        })}
      />
    );
    const toolCall = container.querySelector(".tool-call");
    expect(toolCall).not.toBeNull();
  });
});
