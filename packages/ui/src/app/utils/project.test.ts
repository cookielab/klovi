import { describe, expect, test } from "bun:test";
import type { Project } from "../../shared/types.ts";
import { projectDisplayName } from "./project.ts";

function makeProject(name: string): Project {
  return {
    encodedPath: encodeURIComponent(name),
    name,
    fullPath: `/home/user/.claude/projects/${name}`,
    sessionCount: 1,
    lastActivity: "2025-01-01T00:00:00Z",
  };
}

describe("projectDisplayName", () => {
  test("returns last 2 segments of forward-slash path", () => {
    expect(projectDisplayName(makeProject("Users/alice/my-project"))).toBe("alice/my-project");
  });

  test("returns last 2 segments of backslash path", () => {
    expect(projectDisplayName(makeProject("Users\\alice\\my-project"))).toBe("alice/my-project");
  });

  test("handles mixed slashes", () => {
    expect(projectDisplayName(makeProject("Users/alice\\my-project"))).toBe("alice/my-project");
  });

  test("handles trailing slashes", () => {
    expect(projectDisplayName(makeProject("Users/alice/my-project/"))).toBe("alice/my-project");
  });

  test("returns full name for short paths", () => {
    expect(projectDisplayName(makeProject("my-project"))).toBe("my-project");
  });

  test("returns both segments for two-segment path", () => {
    expect(projectDisplayName(makeProject("alice/my-project"))).toBe("alice/my-project");
  });
});
