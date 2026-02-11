import { describe, expect, test } from "bun:test";
import type { Project, SessionSummary } from "../../shared/types.ts";
import { aggregateSessions, classifySessionTypes } from "./claude-dir.ts";

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

function project(overrides: Partial<Project> & { encodedPath: string }): Project {
  return {
    name: "/Users/dev/my-project",
    fullPath: "/Users/dev/my-project",
    sessionCount: 1,
    lastActivity: "2025-01-15T10:00:00Z",
    ...overrides,
  };
}

describe("aggregateSessions", () => {
  test("aggregates sessions from multiple projects with correct fields", () => {
    const projects = [
      project({ encodedPath: "-Users-dev-project-a", name: "/Users/dev/project-a" }),
      project({ encodedPath: "-Users-dev-project-b", name: "/Users/dev/project-b" }),
    ];
    const sessionsByProject = new Map([
      ["-Users-dev-project-a", [session({ sessionId: "s1", timestamp: "2025-01-15T10:00:00Z" })]],
      ["-Users-dev-project-b", [session({ sessionId: "s2", timestamp: "2025-01-15T11:00:00Z" })]],
    ]);

    const results = aggregateSessions(projects, sessionsByProject);
    expect(results).toHaveLength(2);
    expect(results[0]!.sessionId).toBe("s2");
    expect(results[0]!.encodedPath).toBe("-Users-dev-project-b");
    expect(results[0]!.projectName).toBe("dev/project-b");
    expect(results[1]!.sessionId).toBe("s1");
    expect(results[1]!.encodedPath).toBe("-Users-dev-project-a");
    expect(results[1]!.projectName).toBe("dev/project-a");
  });

  test("sorts all sessions by timestamp descending across projects", () => {
    const projects = [
      project({ encodedPath: "p1", name: "/a/b" }),
      project({ encodedPath: "p2", name: "/c/d" }),
    ];
    const sessionsByProject = new Map([
      [
        "p1",
        [
          session({ sessionId: "s1", timestamp: "2025-01-01T00:00:00Z" }),
          session({ sessionId: "s3", timestamp: "2025-01-03T00:00:00Z" }),
        ],
      ],
      ["p2", [session({ sessionId: "s2", timestamp: "2025-01-02T00:00:00Z" })]],
    ]);

    const results = aggregateSessions(projects, sessionsByProject);
    expect(results.map((r) => r.sessionId)).toEqual(["s3", "s2", "s1"]);
  });

  test("returns empty array when no projects", () => {
    const results = aggregateSessions([], new Map());
    expect(results).toEqual([]);
  });

  test("uses last 2 path segments for projectName", () => {
    const projects = [
      project({
        encodedPath: "encoded",
        name: "/Users/dev/Workspace/Cookielab/Klovi",
      }),
    ];
    const sessionsByProject = new Map([["encoded", [session({ sessionId: "s1" })]]]);

    const results = aggregateSessions(projects, sessionsByProject);
    expect(results[0]!.projectName).toBe("Cookielab/Klovi");
  });

  test("handles project with no sessions", () => {
    const projects = [project({ encodedPath: "p1", name: "/a/b" })];
    const sessionsByProject = new Map<string, SessionSummary[]>();

    const results = aggregateSessions(projects, sessionsByProject);
    expect(results).toEqual([]);
  });
});

describe("classifySessionTypes", () => {
  test("marks implementation sessions by prefix", () => {
    const sessions = [
      session({ sessionId: "s1", firstMessage: "Implement the following plan:\n\n# My plan" }),
    ];
    classifySessionTypes(sessions);
    expect(sessions[0]!.sessionType).toBe("implementation");
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
    expect(sessions[0]!.sessionType).toBe("plan");
    expect(sessions[1]!.sessionType).toBe("implementation");
  });

  test("normal sessions have no sessionType", () => {
    const sessions = [
      session({ sessionId: "s1", slug: "feature-a", firstMessage: "Fix the login bug" }),
      session({ sessionId: "s2", slug: "feature-b", firstMessage: "Add dark mode" }),
    ];
    classifySessionTypes(sessions);
    expect(sessions[0]!.sessionType).toBeUndefined();
    expect(sessions[1]!.sessionType).toBeUndefined();
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
    expect(sessions[0]!.sessionType).toBeUndefined();
    expect(sessions[1]!.sessionType).toBe("implementation");
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
    expect(sessions[0]!.sessionType).toBe("plan");
    expect(sessions[1]!.sessionType).toBe("implementation");
    expect(sessions[2]!.sessionType).toBe("plan");
    expect(sessions[3]!.sessionType).toBe("implementation");
    expect(sessions[4]!.sessionType).toBeUndefined();
  });
});
