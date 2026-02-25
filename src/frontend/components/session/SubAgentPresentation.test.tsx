import { afterEach, describe, expect, test } from "bun:test";
import { cleanup, render, waitFor } from "@testing-library/react";
import type { Session } from "../../../shared/types.ts";
import { setupMockRPC } from "../../test-helpers/mock-rpc.ts";
import { SubAgentPresentation } from "./SubAgentPresentation.tsx";

const STEP_REGEX = /Step/;

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
  afterEach(cleanup);

  test("shows loading state initially", () => {
    setupMockRPC({
      getSubAgent: () => new Promise(() => {}),
    });
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
    setupMockRPC({
      getSubAgent: () => Promise.resolve({ session }),
    });

    const { container, findByText } = render(
      <SubAgentPresentation
        sessionId="session-1"
        project="test-project"
        agentId="agent-1"
        onExit={() => {}}
      />,
    );
    await findByText(STEP_REGEX);
    expect(container.querySelector(".presentation-mode")).not.toBeNull();
  });

  test("returns null when session has no turns", async () => {
    const session = makeSession({ turns: [] });
    setupMockRPC({
      getSubAgent: () => Promise.resolve({ session }),
    });

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
    setupMockRPC({
      getSubAgent: () => Promise.resolve({ session: null as unknown as Session }),
    });

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
