import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { getClaudeCodeDir, setClaudeCodeDir } from "../config.ts";
import { parseSubAgentSession } from "./parser.ts";

const testDir = join(tmpdir(), `klovi-claude-subagent-test-${Date.now()}`);

describe("parseSubAgentSession", () => {
  let originalClaudeDir: string;

  beforeEach(() => {
    originalClaudeDir = getClaudeCodeDir();
    rmSync(testDir, { recursive: true, force: true });
    mkdirSync(testDir, { recursive: true });
    setClaudeCodeDir(testDir);
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
    setClaudeCodeDir(originalClaudeDir);
  });

  test("returns claude pluginId when sub-agent transcript is missing", async () => {
    const session = await parseSubAgentSession("session-1", "-Users-dev-project", "42");

    expect(session).toEqual({
      sessionId: "session-1",
      project: "-Users-dev-project",
      turns: [],
      pluginId: "claude-code",
    });
  });

  test("returns claude pluginId when sub-agent transcript exists", async () => {
    const filePath = join(
      testDir,
      "projects",
      "-Users-dev-project",
      "session-1",
      "subagents",
      "agent-42.jsonl",
    );
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(
      filePath,
      JSON.stringify({
        type: "user",
        uuid: "user-1",
        timestamp: "2025-01-15T10:00:00.000Z",
        message: {
          role: "user",
          content: "hello sub-agent",
        },
      }),
    );

    const session = await parseSubAgentSession("session-1", "-Users-dev-project", "42");

    expect(session.pluginId).toBe("claude-code");
    expect(session.turns).toHaveLength(1);
    expect(session.turns[0]).toMatchObject({
      kind: "user",
      text: "hello sub-agent",
    });
  });
});
