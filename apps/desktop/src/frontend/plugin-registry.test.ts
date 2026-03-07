import { describe, expect, test } from "bun:test";
import { getFrontendPlugin } from "./plugin-registry.ts";

describe("frontend plugin registry", () => {
  test("registers built-in frontend plugins from packages", () => {
    const claude = getFrontendPlugin("claude-code");
    const codex = getFrontendPlugin("codex-cli");
    const opencode = getFrontendPlugin("opencode");

    expect(claude?.displayName).toBe("Claude Code");
    expect(codex?.displayName).toBe("Codex");
    expect(opencode?.displayName).toBe("OpenCode");
  });

  test("uses plugin-provided resume commands", () => {
    expect(getFrontendPlugin("claude-code")?.getResumeCommand?.("abc123")).toBe(
      "claude --resume abc123",
    );
    expect(getFrontendPlugin("codex-cli")?.getResumeCommand?.("abc123")).toBe(
      "codex resume abc123",
    );
    expect(getFrontendPlugin("opencode")?.getResumeCommand).toBeUndefined();
  });

  test("returns undefined for unknown plugin", () => {
    expect(getFrontendPlugin("unknown-plugin")).toBeUndefined();
  });
});
