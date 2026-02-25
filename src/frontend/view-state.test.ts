import { describe, expect, test } from "bun:test";
import { encodeSessionId } from "../shared/session-id.ts";
import { getResumeCommand } from "./view-state.ts";

describe("getResumeCommand", () => {
  test("returns plugin resume command for explicit plugin id", () => {
    expect(getResumeCommand("claude-code", encodeSessionId("claude-code", "abc123"))).toBe(
      "claude --resume abc123",
    );
    expect(getResumeCommand("codex-cli", encodeSessionId("codex-cli", "def456"))).toBe(
      "codex resume def456",
    );
  });

  test("uses plugin id encoded in session id when plugin id is missing", () => {
    expect(getResumeCommand(undefined, encodeSessionId("codex-cli", "xyz789"))).toBe(
      "codex resume xyz789",
    );
  });

  test("returns undefined when plugin has no resume command", () => {
    expect(getResumeCommand("opencode", encodeSessionId("opencode", "xyz789"))).toBeUndefined();
  });

  test("returns undefined for unknown plugin or unencoded session id", () => {
    expect(getResumeCommand("unknown-plugin", "raw-session-id")).toBeUndefined();
    expect(getResumeCommand(undefined, "raw-session-id")).toBeUndefined();
  });
});
