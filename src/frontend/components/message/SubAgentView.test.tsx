import { afterEach, describe, expect, test } from "bun:test";
import { cleanup, render } from "@testing-library/react";
import type { Session } from "../../../shared/types.ts";
import { setupMockRPC } from "../../test-helpers/mock-rpc.ts";
import { SubAgentView } from "./SubAgentView.tsx";

const ERROR_PREFIX_REGEX = /Error:/;
const CONNECTION_REFUSED_REGEX = /Error:.*Connection refused/;

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

// biome-ignore lint/security/noSecrets: test data, not a real secret
describe("SubAgentView", () => {
  afterEach(cleanup);

  test("shows loading state initially", () => {
    setupMockRPC({
      getSubAgent: () => new Promise(() => {}),
    });
    const { container } = render(
      <SubAgentView sessionId="session-1" project="test-project" agentId="agent-1" />,
    );
    expect(container.querySelector(".loading")).not.toBeNull();
    expect(container.textContent).toContain("Loading sub-agent conversation...");
  });

  test("renders sub-agent messages after fetch", async () => {
    const session = makeSession();
    setupMockRPC({
      getSubAgent: () => Promise.resolve({ session }),
    });

    const { findByText } = render(
      <SubAgentView sessionId="session-1" project="test-project" agentId="agent-1" />,
    );
    await findByText("Sub-agent task");
  });

  test("shows error state on fetch failure", async () => {
    setupMockRPC({
      getSubAgent: () => Promise.reject(new Error("HTTP 404")),
    });

    const { findByText } = render(
      <SubAgentView sessionId="session-1" project="test-project" agentId="agent-1" />,
    );
    await findByText(ERROR_PREFIX_REGEX);
  });

  test("shows empty state when session has no turns", async () => {
    const session = makeSession({ turns: [] });
    setupMockRPC({
      getSubAgent: () => Promise.resolve({ session }),
    });

    const { findByText } = render(
      <SubAgentView sessionId="session-1" project="test-project" agentId="agent-1" />,
    );
    await findByText("No sub-agent conversation data available.");
  });

  test("shows error on network error", async () => {
    setupMockRPC({
      getSubAgent: () => Promise.reject(new Error("Connection refused")),
    });

    const { findByText } = render(
      <SubAgentView sessionId="session-1" project="test-project" agentId="agent-1" />,
    );
    await findByText(CONNECTION_REFUSED_REGEX);
  });
});
