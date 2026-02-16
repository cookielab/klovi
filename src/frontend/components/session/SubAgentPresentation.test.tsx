import { afterEach, describe, expect, test } from "bun:test";
import { cleanup, render, waitFor } from "@testing-library/react";
import type { Session } from "../../../shared/types.ts";
import { SubAgentPresentation } from "./SubAgentPresentation.tsx";

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
        text: "Task for sub-agent",
      },
      {
        kind: "assistant",
        uuid: "a1",
        timestamp: "2025-01-15T10:00:01Z",
        model: "claude-opus-4-6",
        contentBlocks: [{ type: "text", text: "Working on it" }],
      },
    ],
    ...overrides,
  };
}

describe("SubAgentPresentation", () => {
  originalFetch = globalThis.fetch;

  afterEach(() => {
    cleanup();
    globalThis.fetch = originalFetch;
  });

  test("shows loading state initially", () => {
    mockFetch(() => new Promise(() => {}));
    const { container } = render(
      <SubAgentPresentation
        sessionId="session-1"
        project="test-project"
        agentId="agent-1"
        onExit={() => {}}
      />,
    );
    expect(container.querySelector(".loading")).not.toBeNull();
    expect(container.textContent).toContain("Loading sub-agent conversation...");
  });

  test("renders presentation mode after fetch", async () => {
    const session = makeSession();
    mockFetch(() => Promise.resolve(new Response(JSON.stringify({ session }), { status: 200 })));

    const { container, findByText } = render(
      <SubAgentPresentation
        sessionId="session-1"
        project="test-project"
        agentId="agent-1"
        onExit={() => {}}
      />,
    );
    await findByText(/Step/);
    expect(container.querySelector(".presentation-mode")).not.toBeNull();
  });

  test("returns null when session has no turns", async () => {
    const session = makeSession({ turns: [] });
    mockFetch(() => Promise.resolve(new Response(JSON.stringify({ session }), { status: 200 })));

    const { container } = render(
      <SubAgentPresentation
        sessionId="session-1"
        project="test-project"
        agentId="agent-1"
        onExit={() => {}}
      />,
    );
    await waitFor(() => {
      expect(container.querySelector(".loading")).toBeNull();
    });
    expect(container.querySelector(".presentation-mode")).toBeNull();
  });

  test("returns null when session is null", async () => {
    mockFetch(() =>
      Promise.resolve(new Response(JSON.stringify({ session: null }), { status: 200 })),
    );

    const { container } = render(
      <SubAgentPresentation
        sessionId="session-1"
        project="test-project"
        agentId="agent-1"
        onExit={() => {}}
      />,
    );
    await waitFor(() => {
      expect(container.querySelector(".loading")).toBeNull();
    });
    expect(container.querySelector(".presentation-mode")).toBeNull();
  });
});
