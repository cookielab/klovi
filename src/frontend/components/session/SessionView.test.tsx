import { afterEach, describe, expect, test } from "bun:test";
import { cleanup, render } from "@testing-library/react";
import type { Session } from "../../../shared/types.ts";
import { setupMockRPC } from "../../test-helpers/mock-rpc.ts";
import { SessionView } from "./SessionView.tsx";

const ERROR_PREFIX_REGEX = /Error:/;
const NETWORK_ERROR_REGEX = /Error:.*Network error/;

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    sessionId: "session-1",
    project: "test-project",
    turns: [
      {
        kind: "user",
        uuid: "u1",
        timestamp: "2025-01-15T10:00:00Z",
        text: "Hello world",
      },
      {
        kind: "assistant",
        uuid: "a1",
        timestamp: "2025-01-15T10:00:01Z",
        model: "claude-opus-4-6",
        contentBlocks: [{ type: "text", text: "Hi there!" }],
      },
    ],
    ...overrides,
  };
}

describe("SessionView", () => {
  afterEach(cleanup);

  test("shows loading state initially", () => {
    setupMockRPC({
      getSession: () => new Promise(() => {}),
    });
    const { container } = render(<SessionView sessionId="session-1" project="test-project" />);
    expect(container.querySelector(".loading")).not.toBeNull();
    expect(container.textContent).toContain("Loading session...");
  });

  test("renders messages after successful fetch", async () => {
    const session = makeSession();
    setupMockRPC({
      getSession: () => Promise.resolve({ session }),
    });

    const { findByText } = render(<SessionView sessionId="session-1" project="test-project" />);
    await findByText("Hello world");
  });

  test("shows error state on fetch failure", async () => {
    setupMockRPC({
      getSession: () => Promise.reject(new Error("HTTP 404")),
    });

    const { findByText } = render(<SessionView sessionId="session-1" project="test-project" />);
    await findByText(ERROR_PREFIX_REGEX);
  });

  test("shows error state on network error", async () => {
    setupMockRPC({
      getSession: () => Promise.reject(new Error("Network error")),
    });

    const { findByText } = render(<SessionView sessionId="session-1" project="test-project" />);
    await findByText(NETWORK_ERROR_REGEX);
  });

  test("renders both user and assistant messages", async () => {
    const session = makeSession();
    setupMockRPC({
      getSession: () => Promise.resolve({ session }),
    });

    const { findByText, container } = render(
      <SessionView sessionId="session-1" project="test-project" />,
    );
    await findByText("Hello world");
    expect(container.querySelector(".message-user")).not.toBeNull();
    expect(container.querySelector(".message-assistant")).not.toBeNull();
  });
});
