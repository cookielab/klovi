import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { codexCliPlugin, getCodexCliDir, setCodexCliDir } from "./index.ts";

const testDir = join(tmpdir(), `klovi-codex-index-test-${Date.now()}`);

function writeSession(
  uuid: string,
  meta: Record<string, unknown>,
  events: Record<string, unknown>[] = [],
): void {
  const dir = join(testDir, "sessions", "openai", "2025-01-15");
  mkdirSync(dir, { recursive: true });
  const filePath = join(dir, `${uuid}.jsonl`);
  const lines = [JSON.stringify(meta), ...events.map((event) => JSON.stringify(event))];
  writeFileSync(filePath, lines.join("\n"));
}

describe("codexCliPlugin", () => {
  let originalDir: string;

  beforeEach(() => {
    originalDir = getCodexCliDir();
    rmSync(testDir, { recursive: true, force: true });
    mkdirSync(testDir, { recursive: true });
    setCodexCliDir(testDir);
  });

  afterEach(() => {
    setCodexCliDir(originalDir);
    rmSync(testDir, { recursive: true, force: true });
  });

  test("exposes plugin identity and resume command", () => {
    expect(codexCliPlugin.id).toBe("codex-cli");
    expect(codexCliPlugin.displayName).toBe("Codex");
    expect(codexCliPlugin.getDefaultDataDir()).toBe(testDir);
    expect(codexCliPlugin.getResumeCommand?.("session-123")).toBe("codex resume session-123");
  });

  test("discovers, lists, and loads sessions through plugin interface", async () => {
    writeSession(
      "uuid-1",
      {
        uuid: "uuid-1",
        name: "Refactor plugin layer",
        cwd: "/Users/dev/project-a",
        timestamps: { created: 1706000000, updated: 1706001000 },
        model: "o4-mini",
        provider_id: "openai",
      },
      [
        { type: "turn.started" },
        {
          type: "item.completed",
          item: { type: "agent_message", text: "I will refactor this safely." },
        },
        { type: "turn.completed", usage: { input_tokens: 100, output_tokens: 40 } },
      ],
    );

    const projects = await codexCliPlugin.discoverProjects();
    expect(projects).toHaveLength(1);
    expect(projects[0]?.resolvedPath).toBe("/Users/dev/project-a");

    const sessions = await codexCliPlugin.listSessions("/Users/dev/project-a");
    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.pluginId).toBe("codex-cli");
    expect(sessions[0]?.sessionId).toBe("uuid-1");

    const session = await codexCliPlugin.loadSession("/Users/dev/project-a", "uuid-1");
    expect(session.pluginId).toBe("codex-cli");
    expect(session.project).toBe("/Users/dev/project-a");
    expect(session.sessionId).toBe("uuid-1");
    expect(session.turns).toHaveLength(1);
  });

  test("returns empty lists for unknown projects", async () => {
    const sessions = await codexCliPlugin.listSessions("/Users/dev/missing");
    expect(sessions).toEqual([]);
  });
});
