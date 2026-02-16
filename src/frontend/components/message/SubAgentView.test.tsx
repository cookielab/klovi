import { afterEach, describe, expect, test } from "bun:test";
import { cleanup, render } from "@testing-library/react";
import type { Session } from "../../../shared/types.ts";
import { SubAgentView } from "./SubAgentView.tsx";

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
        text: "Sub-agent task",
      },
      {
        kind: "assistant",
        uuid: "a1",
        timestamp: "2025-01-15T10:00:01Z",
        model: "claude-opus-4-6",
        contentBlocks: [{ type: "text", text: "Working on it." }],
      },
    ],
    ...overrides,
  };
}

describe("SubAgentView", () => {
  originalFetch = globalThis.fetch;

  afterEach(() => {
    cleanup();
    globalThis.fetch = originalFetch;
  });

  test("shows loading state initially", () => {
    mockFetch(() => new Promise(() => {}));
    const { container } = render(
      <SubAgentView sessionId="session-1" project="test-project" agentId="agent-1" />,
    );
    expect(container.querySelector(".loading")).not.toBeNull();
    expect(container.textContent).toContain("Loading sub-agent conversation...");
  });

  test("renders sub-agent messages after fetch", async () => {
    const session = makeSession();
    mockFetch(() => Promise.resolve(new Response(JSON.stringify({ session }), { status: 200 })));

    const { findByText } = render(
      <SubAgentView sessionId="session-1" project="test-project" agentId="agent-1" />,
    );
    await findByText("Sub-agent task");
  });

  test("shows error state on fetch failure", async () => {
    mockFetch(() => Promise.resolve(new Response("Not Found", { status: 404 })));

    const { findByText } = render(
      <SubAgentView sessionId="session-1" project="test-project" agentId="agent-1" />,
    );
    await findByText(/Error:/);
  });

  test("shows empty state when session has no turns", async () => {
    const session = makeSession({ turns: [] });
    mockFetch(() => Promise.resolve(new Response(JSON.stringify({ session }), { status: 200 })));

    const { findByText } = render(
      <SubAgentView sessionId="session-1" project="test-project" agentId="agent-1" />,
    );
    await findByText("No sub-agent conversation data available.");
  });

  test("shows error on network error", async () => {
    mockFetch(() => Promise.reject(new Error("Connection refused")));

    const { findByText } = render(
      <SubAgentView sessionId="session-1" project="test-project" agentId="agent-1" />,
    );
    await findByText(/Error:.*Connection refused/);
  });
});
