import { afterEach, describe, expect, test } from "bun:test";
import { cleanup, render } from "@testing-library/react";
import type { Session } from "../../../shared/types.ts";
import { SessionView } from "./SessionView.tsx";

let originalFetch: typeof globalThis.fetch;

function mockFetch(response: () => Promise<Response>): void {
  Object.assign(globalThis, {
    fetch: Object.assign(response, { preconnect: globalThis.fetch.preconnect }),
  });
}

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
  originalFetch = globalThis.fetch;

  afterEach(() => {
    cleanup();
    globalThis.fetch = originalFetch;
  });

  test("shows loading state initially", () => {
    mockFetch(() => new Promise(() => {}));
    const { container } = render(<SessionView sessionId="session-1" project="test-project" />);
    expect(container.querySelector(".loading")).not.toBeNull();
    expect(container.textContent).toContain("Loading session...");
  });

  test("renders messages after successful fetch", async () => {
    const session = makeSession();
    mockFetch(() => Promise.resolve(new Response(JSON.stringify({ session }), { status: 200 })));

    const { findByText } = render(<SessionView sessionId="session-1" project="test-project" />);
    await findByText("Hello world");
  });

  test("shows error state on fetch failure", async () => {
    mockFetch(() => Promise.resolve(new Response("Not Found", { status: 404 })));

    const { findByText } = render(<SessionView sessionId="session-1" project="test-project" />);
    await findByText(/Error:/);
  });

  test("shows error state on network error", async () => {
    mockFetch(() => Promise.reject(new Error("Network error")));

    const { findByText } = render(<SessionView sessionId="session-1" project="test-project" />);
    await findByText(/Error:.*Network error/);
  });

  test("renders both user and assistant messages", async () => {
    const session = makeSession();
    mockFetch(() => Promise.resolve(new Response(JSON.stringify({ session }), { status: 200 })));

    const { findByText, container } = render(
      <SessionView sessionId="session-1" project="test-project" />,
    );
    await findByText("Hello world");
    expect(container.querySelector(".message-user")).not.toBeNull();
    expect(container.querySelector(".message-assistant")).not.toBeNull();
  });
});
