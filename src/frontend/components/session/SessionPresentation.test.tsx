import { afterEach, describe, expect, test } from "bun:test";
import { cleanup, render, waitFor } from "@testing-library/react";
import type { Session } from "../../../shared/types.ts";
import { SessionPresentation } from "./SessionPresentation.tsx";

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
        text: "Hello",
      },
      {
        kind: "assistant",
        uuid: "a1",
        timestamp: "2025-01-15T10:00:01Z",
        model: "claude-opus-4-6",
        contentBlocks: [{ type: "text", text: "Response" }],
      },
    ],
    ...overrides,
  };
}

describe("SessionPresentation", () => {
  originalFetch = globalThis.fetch;

  afterEach(() => {
    cleanup();
    globalThis.fetch = originalFetch;
  });

  test("shows loading state initially", () => {
    mockFetch(() => new Promise(() => {}));
    const { container } = render(
      <SessionPresentation sessionId="session-1" project="test-project" onExit={() => {}} />,
    );
    expect(container.querySelector(".loading")).not.toBeNull();
  });

  test("renders presentation mode after fetch", async () => {
    const session = makeSession();
    mockFetch(() => Promise.resolve(new Response(JSON.stringify({ session }), { status: 200 })));

    const { container, findByText } = render(
      <SessionPresentation sessionId="session-1" project="test-project" onExit={() => {}} />,
    );
    await findByText(/Step/);
    expect(container.querySelector(".presentation-mode")).not.toBeNull();
  });

  test("renders progress bar", async () => {
    const session = makeSession();
    mockFetch(() => Promise.resolve(new Response(JSON.stringify({ session }), { status: 200 })));

    const { container, findByText } = render(
      <SessionPresentation sessionId="session-1" project="test-project" onExit={() => {}} />,
    );
    await findByText(/Step/);
    expect(container.querySelector(".presentation-progress-bar")).not.toBeNull();
  });

  test("returns null when no session data", async () => {
    mockFetch(() =>
      Promise.resolve(new Response(JSON.stringify({ session: null }), { status: 200 })),
    );

    const { container } = render(
      <SessionPresentation sessionId="session-1" project="test-project" onExit={() => {}} />,
    );
    await waitFor(() => {
      expect(container.querySelector(".loading")).toBeNull();
    });
    expect(container.querySelector(".presentation-mode")).toBeNull();
  });
});
