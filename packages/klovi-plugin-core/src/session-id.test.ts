import { describe, expect, test } from "bun:test";
import { encodeSessionId, parseSessionId } from "./session-id.ts";

describe("session id codec", () => {
  test("encodes plugin and raw session id", () => {
    expect(encodeSessionId("claude-code", "abc")).toBe("claude-code::abc");
  });

  test("parses encoded session id", () => {
    expect(parseSessionId("codex-cli::session-1")).toEqual({
      pluginId: "codex-cli",
      rawSessionId: "session-1",
    });
  });

  test("treats unencoded id as raw session id", () => {
    expect(parseSessionId("session-plain")).toEqual({
      pluginId: null,
      rawSessionId: "session-plain",
    });
  });

  test("splits at first separator only", () => {
    expect(parseSessionId("opencode::nested::id")).toEqual({
      pluginId: "opencode",
      rawSessionId: "nested::id",
    });
  });
});
