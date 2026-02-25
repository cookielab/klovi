import { afterEach, describe, expect, test } from "bun:test";
import { cleanup, render } from "@testing-library/react";
import type { AssistantTurn } from "../../../shared/types.ts";
import { AssistantMessage } from "./AssistantMessage.tsx";

afterEach(cleanup);

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
  test("model name display -- Opus", () => {
    const { container } = render(
      <AssistantMessage turn={makeTurn({ model: "claude-opus-4-6" })} />,
    );
    expect(container.textContent).toContain("Opus");
  });

  test("model name display -- Sonnet", () => {
    const { container } = render(
      <AssistantMessage turn={makeTurn({ model: "claude-sonnet-4-5-20250929" })} />,
    );
    expect(container.textContent).toContain("Sonnet");
  });

  test("model name display -- Haiku", () => {
    const { container } = render(
      <AssistantMessage turn={makeTurn({ model: "claude-haiku-4-5-20251001" })} />,
    );
    expect(container.textContent).toContain("Haiku");
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
    expect(container.textContent).toContain("1,500 in");
    expect(container.textContent).toContain("300 out");
    expect(container.textContent).toContain("1,200 cache read");
    expect(container.textContent).toContain("100 cache write");
  });

  test("token usage footer hidden when no usage", () => {
    const { container } = render(
      <AssistantMessage turn={makeTurn({ contentBlocks: [{ type: "text", text: "Hello" }] })} />,
    );
    expect(container.textContent).not.toContain(" in /");
  });

  test("thinking blocks rendered", () => {
    const { container } = render(
      <AssistantMessage
        turn={makeTurn({
          contentBlocks: [{ type: "thinking", block: { text: "Let me think..." } }],
        })}
      />,
    );
    expect(container.textContent).toContain("Thinking:");
  });

  test("text blocks rendered as markdown", () => {
    const { container } = render(
      <AssistantMessage
        turn={makeTurn({
          contentBlocks: [{ type: "text", text: "Hello **bold** world" }],
        })}
      />,
    );
    const strong = container.querySelector("strong");
    expect(strong).not.toBeNull();
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
    expect(container.textContent).toContain("Bash");
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
    expect(container.textContent).toContain("First message");
    expect(container.textContent).toContain("Second message");
    expect(container.textContent).not.toContain("Third message");
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
    expect(container.textContent).toContain("First");
    expect(container.textContent).toContain("Second");
    expect(container.textContent).toContain("Third");
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
    expect(container.textContent).not.toContain(" in /");
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
    expect(container.textContent).toContain("100 in");
    expect(container.textContent).toContain("50 out");
    expect(container.textContent).not.toContain("cache read");
    expect(container.textContent).not.toContain("cache write");
  });
});
