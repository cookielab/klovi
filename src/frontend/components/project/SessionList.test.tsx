import { afterEach, describe, expect, mock, test } from "bun:test";
import { cleanup, fireEvent, render } from "@testing-library/react";
import type { Project, SessionSummary } from "../../../shared/types.ts";
import { setupMockRPC } from "../../test-helpers/mock-rpc.ts";
import { SessionList } from "./SessionList.tsx";

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    encodedPath: "test-project",
    name: "/Users/test/my-project",
    fullPath: "/Users/test/my-project",
    sessionCount: 5,
    lastActivity: new Date().toISOString(),
    ...overrides,
  };
}

function makeSession(overrides: Partial<SessionSummary> = {}): SessionSummary {
  return {
    sessionId: "session-1",
    timestamp: "2025-01-15T10:00:00Z",
    slug: "test-session",
    firstMessage: "Hello world",
    model: "claude-opus-4-6",
    gitBranch: "main",
    ...overrides,
  };
}

describe("SessionList", () => {
  afterEach(cleanup);

  test("shows loading state initially", () => {
    setupMockRPC({
      getSessions: () => new Promise(() => {}),
    });
    const { container } = render(
      <SessionList project={makeProject()} onSelect={() => {}} onBack={() => {}} />,
    );
    expect(container.querySelector(".loading")).not.toBeNull();
  });

  test("renders sessions after fetch", async () => {
    const sessions = [
      makeSession({ sessionId: "s1", firstMessage: "First" }),
      makeSession({ sessionId: "s2", firstMessage: "Second" }),
    ];
    setupMockRPC({
      getSessions: () => Promise.resolve({ sessions }),
    });

    const { findByText, container } = render(
      <SessionList project={makeProject()} onSelect={() => {}} onBack={() => {}} />,
    );
    await findByText("First");
    expect(container.querySelectorAll(".list-item").length).toBe(2);
  });

  test("calls onBack when back button clicked", async () => {
    setupMockRPC({
      getSessions: () => Promise.resolve({ sessions: [] }),
    });
    const onBack = mock(() => {});

    const { container, findByText } = render(
      <SessionList project={makeProject()} onSelect={() => {}} onBack={onBack} />,
    );
    await findByText("No sessions found");
    const backBtn = container.querySelector(".back-btn")!;
    fireEvent.click(backBtn);
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  test("calls onSelect when session clicked", async () => {
    const session = makeSession({ sessionId: "s1" });
    setupMockRPC({
      getSessions: () => Promise.resolve({ sessions: [session] }),
    });

    const onSelect = mock(() => {});
    const { container, findByText } = render(
      <SessionList project={makeProject()} onSelect={onSelect} onBack={() => {}} />,
    );
    await findByText("Hello world");
    const item = container.querySelector(".list-item")!;
    fireEvent.click(item);
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  test("renders session type badge for plan session", async () => {
    const sessions = [makeSession({ sessionType: "plan" })];
    setupMockRPC({
      getSessions: () => Promise.resolve({ sessions }),
    });

    const { findByText } = render(
      <SessionList project={makeProject()} onSelect={() => {}} onBack={() => {}} />,
    );
    await findByText("Plan");
  });

  test("does not render model name in session list", async () => {
    const sessions = [makeSession({ model: "claude-opus-4-6" })];
    setupMockRPC({
      getSessions: () => Promise.resolve({ sessions }),
    });

    const { container, findByText } = render(
      <SessionList project={makeProject()} onSelect={() => {}} onBack={() => {}} />,
    );
    await findByText("Hello world");
    const meta = container.querySelector(".list-item-meta")!;
    expect(meta.textContent).not.toMatch(/Opus/);
  });

  test("renders plugin badge with correct class when pluginId is set", async () => {
    const sessions = [makeSession({ pluginId: "claude-code", model: "claude-opus-4-6" })];
    setupMockRPC({
      getSessions: () => Promise.resolve({ sessions }),
    });

    const { container, findByText } = render(
      <SessionList project={makeProject()} onSelect={() => {}} onBack={() => {}} />,
    );
    await findByText(/Claude Code/);
    const badge = container.querySelector(".plugin-badge")!;
    expect(badge).not.toBeNull();
    expect(badge.textContent).toMatch(/Claude Code/);
    const meta = container.querySelector(".list-item-meta")!;
    expect(meta.textContent).not.toMatch(/Opus/);
  });

  test("does not render git branch in session list", async () => {
    const sessions = [makeSession({ gitBranch: "feature/test" })];
    setupMockRPC({
      getSessions: () => Promise.resolve({ sessions }),
    });

    const { container, findByText } = render(
      <SessionList project={makeProject()} onSelect={() => {}} onBack={() => {}} />,
    );
    await findByText("Hello world");
    const meta = container.querySelector(".list-item-meta")!;
    expect(meta.textContent).not.toMatch(/feature\/test/);
  });

  test("shows empty message when no sessions", async () => {
    setupMockRPC({
      getSessions: () => Promise.resolve({ sessions: [] }),
    });

    const { findByText } = render(
      <SessionList project={makeProject()} onSelect={() => {}} onBack={() => {}} />,
    );
    await findByText("No sessions found");
  });

  test("marks selected session as active", async () => {
    const session = makeSession({ sessionId: "s1" });
    setupMockRPC({
      getSessions: () => Promise.resolve({ sessions: [session] }),
    });

    const { container, findByText } = render(
      <SessionList project={makeProject()} onSelect={() => {}} onBack={() => {}} selectedId="s1" />,
    );
    await findByText("Hello world");
    expect(container.querySelector(".list-item.active")).not.toBeNull();
  });

  test("falls back to slug when firstMessage is empty", async () => {
    const sessions = [makeSession({ firstMessage: "", slug: "my-slug" })];
    setupMockRPC({
      getSessions: () => Promise.resolve({ sessions }),
    });

    const { findByText } = render(
      <SessionList project={makeProject()} onSelect={() => {}} onBack={() => {}} />,
    );
    await findByText("my-slug");
  });

  test("displays project name from path segments", () => {
    setupMockRPC({
      getSessions: () => new Promise(() => {}),
    });
    const { container } = render(
      <SessionList
        project={makeProject({ name: "/Users/test/my-project" })}
        onSelect={() => {}}
        onBack={() => {}}
      />,
    );
    expect(container.querySelector(".list-section-title")!.textContent).toBe("test/my-project");
  });
});
