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
    expect(notice?.textContent).toBe("[Request interrupted by user]");
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
    expect(badge?.textContent).toBe("/commit");
    const skillBadge = container.querySelector(".tool-skill-badge");
    expect(skillBadge).not.toBeNull();
    expect(skillBadge?.textContent).toBe("skill");
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
    expect(badge?.textContent).toBe("image/png");
  });

  test("bash-input renders as user card with command section", () => {
    const { container } = render(
      <UserMessage turn={makeTurn({ text: "", bashInput: "bun run dev" })} />,
    );
    expect(container.querySelector(".turn")).not.toBeNull();
    expect(container.querySelector(".turn-badge-user")).not.toBeNull();
    expect(container.querySelector(".tool-section-label")).not.toBeNull();
    expect(container.querySelector(".tool-section-label")?.textContent).toBe("Command");
  });

  test("ide_opened_file renders with file path styling", () => {
    const { container } = render(
      <UserMessage turn={makeTurn({ text: "", ideOpenedFile: "/Users/dev/project/.env" })} />,
    );
    const notice = container.querySelector(".ide-opened-file-notice");
    expect(notice).not.toBeNull();
    const path = container.querySelector(".ide-opened-file-path");
    expect(path).not.toBeNull();
    expect(path?.textContent).toBe("/Users/dev/project/.env");
  });

  test("bash stdout renders as user card with SmartToolOutput", () => {
    const { container } = render(
      <UserMessage turn={makeTurn({ text: "", bashStdout: "output line 1\noutput line 2" })} />,
    );
    expect(container.querySelector(".turn")).not.toBeNull();
    expect(container.querySelector(".turn-badge-user")).not.toBeNull();
    const labels = container.querySelectorAll(".tool-section-label");
    expect(labels.length).toBeGreaterThanOrEqual(1);
    expect(labels[0]?.textContent).toBe("Output");
  });

  test("bash stderr renders inside user card", () => {
    const { container } = render(
      <UserMessage
        turn={makeTurn({ text: "", bashStdout: "ok", bashStderr: "warning: something" })}
      />,
    );
    expect(container.querySelector(".turn")).not.toBeNull();
    expect(container.querySelector(".turn-badge-user")).not.toBeNull();
  });

  test("merged bash-input + bash-stdout renders command and output", () => {
    const { container } = render(
      <UserMessage turn={makeTurn({ text: "", bashInput: "ls", bashStdout: "file.txt" })} />,
    );
    expect(container.querySelector(".turn")).not.toBeNull();
    const labels = container.querySelectorAll(".tool-section-label");
    const labelTexts = Array.from(labels).map((l) => l.textContent);
    expect(labelTexts).toContain("Command");
    expect(labelTexts).toContain("Output");
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
    const role = container.querySelector(".turn-badge");
    expect(role?.textContent).toContain("User");
  });

  test("renders 'Root Agent' label with .message-root-agent class when isSubAgent", () => {
    const { container } = render(<UserMessage turn={makeTurn()} isSubAgent />);
    const message = container.querySelector(".message-root-agent");
    expect(message).not.toBeNull();
    expect(container.querySelector(".message-user")).toBeNull();
    const role = container.querySelector(".turn-badge");
    expect(role?.textContent).toContain("Root Agent");
  });

  test("renders plan session link when planSessionId and project are provided", () => {
    const { container } = render(
      <UserMessage
        turn={makeTurn({ text: "Implement the following plan:\n\n# My Plan" })}
        planSessionId="plan-123"
        project="my-project"
      />,
    );
    const link = container.querySelector(".subagent-link") as HTMLAnchorElement | null;
    expect(link).not.toBeNull();
    expect(link?.textContent).toBe("View planning session");
    expect(link?.getAttribute("href")).toBe("#/my-project/plan-123");
  });

  test("does not render plan link for regular user messages", () => {
    const { container } = render(
      <UserMessage
        turn={makeTurn({ text: "Hello, help me with something" })}
        planSessionId="plan-123"
        project="my-project"
      />,
    );
    const link = container.querySelector(".subagent-link");
    expect(link).toBeNull();
  });

  test("does not render plan link when planSessionId is absent", () => {
    const { container } = render(
      <UserMessage
        turn={makeTurn({ text: "Implement the following plan:\n\n# Plan" })}
        project="my-project"
      />,
    );
    const link = container.querySelector(".subagent-link");
    expect(link).toBeNull();
  });

  test("renders impl session link when implSessionId and project are provided", () => {
    const { container } = render(
      <UserMessage
        turn={makeTurn({ text: "Help me plan a feature" })}
        implSessionId="impl-456"
        project="my-project"
      />,
    );
    const link = container.querySelector(".subagent-link") as HTMLAnchorElement | null;
    expect(link).not.toBeNull();
    expect(link?.textContent).toBe("View implementation session");
    expect(link?.getAttribute("href")).toBe("#/my-project/impl-456");
  });

  test("does not render impl link when implSessionId is absent", () => {
    const { container } = render(
      <UserMessage turn={makeTurn({ text: "Help me plan a feature" })} project="my-project" />,
    );
    const link = container.querySelector(".subagent-link");
    expect(link).toBeNull();
  });

  test("does not render impl link on plan-prefix messages", () => {
    const { container } = render(
      <UserMessage
        turn={makeTurn({ text: "Implement the following plan:\n\n# My Plan" })}
        implSessionId="impl-456"
        planSessionId="plan-123"
        project="my-project"
      />,
    );
    const links = container.querySelectorAll(".subagent-link");
    expect(links).toHaveLength(1);
    expect(links[0]?.textContent).toBe("View planning session");
  });
});
