import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setClaudeCodeDir } from "../../config.ts";
import { discoverClaudeProjects, listClaudeSessions } from "./discovery.ts";

const testDir = join(tmpdir(), `klovi-claude-discovery-test-${Date.now()}`);

function writeSession(projectId: string, sessionId: string, lines: string[]): string {
  const projectDir = join(testDir, "projects", projectId);
  mkdirSync(projectDir, { recursive: true });
  const filePath = join(projectDir, `${sessionId}.jsonl`);
  writeFileSync(filePath, lines.join("\n"));
  return filePath;
}

beforeEach(() => {
  rmSync(testDir, { recursive: true, force: true });
  mkdirSync(testDir, { recursive: true });
  setClaudeCodeDir(testDir);
});

afterEach(() => {
  rmSync(testDir, { recursive: true, force: true });
});

describe("claude-code discovery", () => {
  test("discoverClaudeProjects returns empty when projects dir is missing", async () => {
    const projects = await discoverClaudeProjects();
    expect(projects).toEqual([]);
  });

  test("listClaudeSessions returns empty when project dir is missing", async () => {
    const sessions = await listClaudeSessions("missing-project");
    expect(sessions).toEqual([]);
  });

  test("discovers projects and lists sessions from valid jsonl files", async () => {
    writeSession("-Users-dev-project-a", "session-1", [
      JSON.stringify({
        type: "user",
        timestamp: "2025-01-15T10:00:00.000Z",
        slug: "feature-a",
        gitBranch: "main",
        cwd: "/Users/dev/project-a",
        isMeta: false,
        message: {
          model: "claude-sonnet-4-5-20250929",
          content: "Fix login flow",
        },
      }),
    ]);

    const projects = await discoverClaudeProjects();
    expect(projects).toHaveLength(1);
    expect(projects[0]!.resolvedPath).toBe("/Users/dev/project-a");
    expect(projects[0]!.sessionCount).toBe(1);

    const sessions = await listClaudeSessions("-Users-dev-project-a");
    expect(sessions).toHaveLength(1);
    expect(sessions[0]!.sessionId).toBe("session-1");
    expect(sessions[0]!.pluginId).toBe("claude-code");
    expect(sessions[0]!.firstMessage).toBe("Fix login flow");
  });
});
