import { describe, expect, test } from "bun:test";
import { render } from "@testing-library/react";
import type { UserTurn } from "../../../shared/types.ts";
import { UserMessage } from "./UserMessage.tsx";

function makeTurn(overrides: Partial<UserTurn> = {}): UserTurn {
  return {
    kind: "user",
    uuid: "u1",
    timestamp: "2024-01-15T10:00:00Z",
    text: "Hello",
    ...overrides,
  };
}

describe("UserMessage", () => {
  test("status notice for [bracketed text]", () => {
    const { container } = render(
      <UserMessage turn={makeTurn({ text: "[Request interrupted by user]" })} />,
    );
    const notice = container.querySelector(".status-notice");
    expect(notice).not.toBeNull();
    expect(notice!.textContent).toBe("[Request interrupted by user]");
  });

  test("command call badge for slash commands", () => {
    const { container } = render(
      <UserMessage
        turn={makeTurn({
          text: "fix the bug",
          command: { name: "/commit", args: "fix the bug" },
        })}
      />,
    );
    const badge = container.querySelector(".command-call-label");
    expect(badge).not.toBeNull();
    expect(badge!.textContent).toBe("/commit");
  });

  test("attachment badges for images", () => {
    const { container } = render(
      <UserMessage
        turn={makeTurn({
          text: "See this",
          attachments: [{ type: "image", mediaType: "image/png" }],
        })}
      />,
    );
    const badge = container.querySelector(".attachment-badge");
    expect(badge).not.toBeNull();
    expect(badge!.textContent).toBe("image/png");
  });

  test("regular markdown text renders", () => {
    const { container } = render(<UserMessage turn={makeTurn({ text: "Hello **world**" })} />);
    const message = container.querySelector(".message-user");
    expect(message).not.toBeNull();
    // Should not be a status notice
    expect(container.querySelector(".status-notice")).toBeNull();
  });

  test("renders 'User' label with .message-user class by default", () => {
    const { container } = render(<UserMessage turn={makeTurn()} />);
    const message = container.querySelector(".message-user");
    expect(message).not.toBeNull();
    expect(container.querySelector(".message-root-agent")).toBeNull();
    const role = container.querySelector(".message-role");
    expect(role!.textContent).toContain("User");
  });

  test("renders 'Root Agent' label with .message-root-agent class when isSubAgent", () => {
    const { container } = render(<UserMessage turn={makeTurn()} isSubAgent />);
    const message = container.querySelector(".message-root-agent");
    expect(message).not.toBeNull();
    expect(container.querySelector(".message-user")).toBeNull();
    const role = container.querySelector(".message-role");
    expect(role!.textContent).toContain("Root Agent");
  });
});
