import { describe, expect, test } from "bun:test";
import { render } from "@testing-library/react";
import type {
  AssistantTurn,
  ParseErrorTurn,
  SystemTurn,
  Turn,
  UserTurn,
} from "../../../shared/types.ts";
import { MessageList } from "./MessageList.tsx";

function userTurn(overrides: Partial<UserTurn> = {}): UserTurn {
  return {
    kind: "user",
    uuid: "u1",
    timestamp: "2024-01-15T10:00:00Z",
    text: "Hello there",
    ...overrides,
  };
}

function assistantTurn(overrides: Partial<AssistantTurn> = {}): AssistantTurn {
  return {
    kind: "assistant",
    uuid: "a1",
    timestamp: "2024-01-15T10:01:00Z",
    model: "claude-sonnet-4-5-20250929",
    contentBlocks: [{ type: "text", text: "Hi!" }],
    ...overrides,
  };
}

function systemTurn(overrides: Partial<SystemTurn> = {}): SystemTurn {
  return {
    kind: "system",
    uuid: "s1",
    timestamp: "2024-01-15T10:02:00Z",
    text: "System message",
    ...overrides,
  };
}

function parseErrorTurn(overrides: Partial<ParseErrorTurn> = {}): ParseErrorTurn {
  return {
    kind: "parse_error",
    uuid: "pe1",
    timestamp: "",
    lineNumber: 42,
    rawLine: '{"invalid json',
    errorType: "json_parse",
    errorDetails: "Unexpected token",
    ...overrides,
  };
}

describe("MessageList", () => {
  test("renders user and assistant messages", () => {
    const turns: Turn[] = [userTurn(), assistantTurn()];
    const { container } = render(<MessageList turns={turns} />);
    expect(container.querySelector(".message-user")).not.toBeNull();
    expect(container.querySelector(".message-assistant")).not.toBeNull();
  });

  test("renders system messages", () => {
    const turns: Turn[] = [systemTurn()];
    const { container } = render(<MessageList turns={turns} />);
    const system = container.querySelector(".message-system");
    expect(system).not.toBeNull();
    expect(system!.textContent).toContain("System");
  });

  test("renders empty list with no turns", () => {
    const { container } = render(<MessageList turns={[]} />);
    const list = container.querySelector(".message-list");
    expect(list).not.toBeNull();
    expect(list!.children).toHaveLength(0);
  });

  test("renders all turn types in sequence", () => {
    const turns: Turn[] = [
      userTurn({ uuid: "u1" }),
      assistantTurn({ uuid: "a1" }),
      systemTurn({ uuid: "s1" }),
      userTurn({ uuid: "u2", text: "Follow up" }),
    ];
    const { container } = render(<MessageList turns={turns} />);
    const list = container.querySelector(".message-list");
    expect(list!.children).toHaveLength(4);
  });

  test("status-only user messages are not given implSessionId", () => {
    // Status messages like "[Interrupted]" should not receive the impl session link
    const turns: Turn[] = [
      userTurn({ uuid: "u-status", text: "[Interrupted]" }),
      userTurn({ uuid: "u-real", text: "Real question" }),
    ];
    const { container } = render(
      <MessageList turns={turns} implSessionId="impl-123" project="p1" />,
    );
    // The first real user message (non-status) should have the link, not the status one
    const list = container.querySelector(".message-list");
    expect(list!.children).toHaveLength(2);
  });

  test("marks last turn as active when visibleSubSteps provided", () => {
    const turns: Turn[] = [userTurn({ uuid: "u1" }), assistantTurn({ uuid: "a1" })];
    const visibleSubSteps = new Map<number, number>();
    visibleSubSteps.set(1, 1);
    const { container } = render(<MessageList turns={turns} visibleSubSteps={visibleSubSteps} />);
    const list = container.querySelector(".message-list");
    const lastChild = list!.children[1] as HTMLElement;
    expect(lastChild.classList.contains("active-message")).toBe(true);
  });

  test("no active-message class without visibleSubSteps", () => {
    const turns: Turn[] = [userTurn(), assistantTurn()];
    const { container } = render(<MessageList turns={turns} />);
    expect(container.querySelector(".active-message")).toBeNull();
  });

  test("renders sub-agent mode (isSubAgent)", () => {
    const turns: Turn[] = [userTurn()];
    const { container } = render(<MessageList turns={turns} isSubAgent />);
    // In sub-agent mode, user turns show "Root Agent" instead of "You"
    const role = container.querySelector(".turn-badge");
    expect(role!.textContent).toContain("Root Agent");
  });

  test("renders parse error messages", () => {
    const turns: Turn[] = [parseErrorTurn()];
    const { container } = render(<MessageList turns={turns} />);
    const turn = container.querySelector(".turn");
    expect(turn).not.toBeNull();
    expect(turn!.textContent).toContain("Parse Error");
    expect(turn!.textContent).toContain("line 42");
    const el = container.querySelector(".message-parse-error");
    expect(el).not.toBeNull();
    expect(el!.textContent).toContain("Invalid JSON");
  });

  test("renders parse error without line number when lineNumber is 0", () => {
    const turns: Turn[] = [parseErrorTurn({ lineNumber: 0, errorType: "invalid_structure" })];
    const { container } = render(<MessageList turns={turns} />);
    const el = container.querySelector(".message-parse-error");
    expect(el).not.toBeNull();
    expect(el!.textContent).toContain("Invalid Structure");
    expect(el!.textContent).not.toContain("line 0");
  });
});
