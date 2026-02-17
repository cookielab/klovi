import { describe, expect, test } from "bun:test";
import { render } from "@testing-library/react";
import type { AssistantTurn } from "../../../shared/types.ts";
import { AssistantMessage } from "./AssistantMessage.tsx";

function makeTurn(overrides: Partial<AssistantTurn> = {}): AssistantTurn {
  return {
    kind: "assistant",
    uuid: "a1",
    timestamp: "2024-01-15T10:00:00Z",
    model: "claude-sonnet-4-5-20250929",
    contentBlocks: [],
    ...overrides,
  };
}

describe("AssistantMessage", () => {
  test("model name display — Opus", () => {
    const { container } = render(
      <AssistantMessage turn={makeTurn({ model: "claude-opus-4-6" })} />,
    );
    const role = container.querySelector(".turn-badge-model");
    expect(role!.textContent).toContain("Opus");
  });

  test("model name display — Sonnet", () => {
    const { container } = render(
      <AssistantMessage turn={makeTurn({ model: "claude-sonnet-4-5-20250929" })} />,
    );
    const role = container.querySelector(".turn-badge-model");
    expect(role!.textContent).toContain("Sonnet");
  });

  test("model name display — Haiku", () => {
    const { container } = render(
      <AssistantMessage turn={makeTurn({ model: "claude-haiku-4-5-20251001" })} />,
    );
    const role = container.querySelector(".turn-badge-model");
    expect(role!.textContent).toContain("Haiku");
  });

  test("token usage footer displayed when usage exists", () => {
    const { container } = render(
      <AssistantMessage
        turn={makeTurn({
          contentBlocks: [{ type: "text", text: "Hello" }],
          usage: {
            inputTokens: 1500,
            outputTokens: 300,
            cacheReadTokens: 1200,
            cacheCreationTokens: 100,
          },
        })}
      />,
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
      <AssistantMessage turn={makeTurn({ contentBlocks: [{ type: "text", text: "Hello" }] })} />,
    );
    const usage = container.querySelector(".token-usage");
    expect(usage).toBeNull();
  });

  test("thinking blocks rendered", () => {
    const { container } = render(
      <AssistantMessage
        turn={makeTurn({
          contentBlocks: [{ type: "thinking", block: { text: "Let me think..." } }],
        })}
      />,
    );
    const thinking = container.querySelector(".thinking-block");
    expect(thinking).not.toBeNull();
  });

  test("text blocks rendered as markdown", () => {
    const { container } = render(
      <AssistantMessage
        turn={makeTurn({
          contentBlocks: [{ type: "text", text: "Hello **bold** world" }],
        })}
      />,
    );
    const content = container.querySelector(".markdown-content");
    expect(content).not.toBeNull();
  });

  test("tool calls rendered", () => {
    const { container } = render(
      <AssistantMessage
        turn={makeTurn({
          contentBlocks: [
            {
              type: "tool_call",
              call: {
                toolUseId: "t1",
                name: "Bash",
                input: { command: "ls" },
                result: "file.ts",
                isError: false,
              },
            },
          ],
        })}
      />,
    );
    const toolCall = container.querySelector(".tool-call");
    expect(toolCall).not.toBeNull();
  });

  test("visibleSubSteps limits rendered content groups", () => {
    const { container } = render(
      <AssistantMessage
        turn={makeTurn({
          contentBlocks: [
            { type: "text", text: "First message" },
            { type: "text", text: "Second message" },
            { type: "text", text: "Third message" },
          ],
        })}
        visibleSubSteps={2}
      />,
    );
    // Each text block = 1 group, visibleSubSteps=2 means only first 2 shown
    const markdowns = container.querySelectorAll(".markdown-content");
    expect(markdowns).toHaveLength(2);
  });

  test("all groups shown when visibleSubSteps undefined", () => {
    const { container } = render(
      <AssistantMessage
        turn={makeTurn({
          contentBlocks: [
            { type: "text", text: "First" },
            { type: "text", text: "Second" },
            { type: "text", text: "Third" },
          ],
        })}
      />,
    );
    const markdowns = container.querySelectorAll(".markdown-content");
    expect(markdowns).toHaveLength(3);
  });

  test("step-enter class on last visible item in presentation mode", () => {
    const { container } = render(
      <AssistantMessage
        turn={makeTurn({
          contentBlocks: [
            { type: "text", text: "First" },
            { type: "text", text: "Second" },
          ],
        })}
        visibleSubSteps={2}
      />,
    );
    const stepEnter = container.querySelector(".step-enter");
    expect(stepEnter).not.toBeNull();
  });

  test("empty contentBlocks renders without error", () => {
    const { container } = render(<AssistantMessage turn={makeTurn({ contentBlocks: [] })} />);
    expect(container.querySelector(".message-assistant")).not.toBeNull();
    expect(container.querySelector(".token-usage")).toBeNull();
  });

  test("cache tokens hidden when zero", () => {
    const { container } = render(
      <AssistantMessage
        turn={makeTurn({
          contentBlocks: [{ type: "text", text: "Hi" }],
          usage: {
            inputTokens: 100,
            outputTokens: 50,
            cacheReadTokens: 0,
            cacheCreationTokens: 0,
          },
        })}
      />,
    );
    const usage = container.querySelector(".token-usage");
    expect(usage).not.toBeNull();
    expect(usage!.textContent).not.toContain("cache read");
    expect(usage!.textContent).not.toContain("cache write");
  });
});
