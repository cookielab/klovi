import { describe, expect, test } from "bun:test";
import { classifySessionTypes } from "../plugins/claude-code/discovery.ts";
import type { SessionSummary } from "../shared/types.ts";

function session(overrides: Partial<SessionSummary> & { sessionId: string }): SessionSummary {
  return {
    timestamp: "2025-01-15T10:00:00Z",
    slug: "test-slug",
    firstMessage: "Hello world",
    model: "claude-sonnet-4-5-20250929",
    gitBranch: "main",
    ...overrides,
  };
}

describe("classifySessionTypes", () => {
  test("marks implementation sessions by prefix", () => {
    const sessions = [
      session({ sessionId: "s1", firstMessage: "Implement the following plan:\n\n# My plan" }),
    ];
    classifySessionTypes(sessions);
    expect(sessions[0]?.sessionType).toBe("implementation");
  });

  test("marks plan sessions by slug match with implementation session", () => {
    const sessions = [
      session({ sessionId: "s1", slug: "my-feature", firstMessage: "Add a logout button" }),
      session({
        sessionId: "s2",
        slug: "my-feature",
        firstMessage: "Implement the following plan:\n\n# Plan",
      }),
    ];
    classifySessionTypes(sessions);
    expect(sessions[0]?.sessionType).toBe("plan");
    expect(sessions[1]?.sessionType).toBe("implementation");
  });

  test("normal sessions have no sessionType", () => {
    const sessions = [
      session({ sessionId: "s1", slug: "feature-a", firstMessage: "Fix the login bug" }),
      session({ sessionId: "s2", slug: "feature-b", firstMessage: "Add dark mode" }),
    ];
    classifySessionTypes(sessions);
    expect(sessions[0]?.sessionType).toBeUndefined();
    expect(sessions[1]?.sessionType).toBeUndefined();
  });

  test("does not mark plan for different slugs", () => {
    const sessions = [
      session({ sessionId: "s1", slug: "feature-a", firstMessage: "Add a button" }),
      session({
        sessionId: "s2",
        slug: "feature-b",
        firstMessage: "Implement the following plan:\n\n# Plan",
      }),
    ];
    classifySessionTypes(sessions);
    expect(sessions[0]?.sessionType).toBeUndefined();
    expect(sessions[1]?.sessionType).toBe("implementation");
  });

  test("handles multiple plan+impl pairs", () => {
    const sessions = [
      session({ sessionId: "s1", slug: "feat-1", firstMessage: "Plan feat 1" }),
      session({
        sessionId: "s2",
        slug: "feat-1",
        firstMessage: "Implement the following plan:\n\nfeat 1",
      }),
      session({ sessionId: "s3", slug: "feat-2", firstMessage: "Plan feat 2" }),
      session({
        sessionId: "s4",
        slug: "feat-2",
        firstMessage: "Implement the following plan:\n\nfeat 2",
      }),
      session({ sessionId: "s5", slug: "feat-3", firstMessage: "Normal session" }),
    ];
    classifySessionTypes(sessions);
    expect(sessions[0]?.sessionType).toBe("plan");
    expect(sessions[1]?.sessionType).toBe("implementation");
    expect(sessions[2]?.sessionType).toBe("plan");
    expect(sessions[3]?.sessionType).toBe("implementation");
    expect(sessions[4]?.sessionType).toBeUndefined();
  });
});
