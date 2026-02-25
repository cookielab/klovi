import { describe, expect, test } from "bun:test";
import {
  BUILTIN_KLOVI_PLUGIN_DISPLAY_NAMES,
  BUILTIN_KLOVI_PLUGIN_IDS,
  isBuiltinKloviPluginId,
  KLOVI_PLUGIN_PACKAGE_NAMES,
} from "./ids.ts";

describe("plugin ids", () => {
  test("lists all supported built-in plugin ids", () => {
    expect(BUILTIN_KLOVI_PLUGIN_IDS).toEqual(["claude-code", "codex-cli", "opencode"]);
    expect(BUILTIN_KLOVI_PLUGIN_DISPLAY_NAMES["claude-code"]).toBe("Claude Code");
    expect(BUILTIN_KLOVI_PLUGIN_DISPLAY_NAMES["codex-cli"]).toBe("Codex");
    expect(BUILTIN_KLOVI_PLUGIN_DISPLAY_NAMES.opencode).toBe("OpenCode");
  });

  test("detects whether a value is a built-in plugin id", () => {
    expect(isBuiltinKloviPluginId("claude-code")).toBe(true);
    expect(isBuiltinKloviPluginId("codex-cli")).toBe(true);
    expect(isBuiltinKloviPluginId("opencode")).toBe(true);
    expect(isBuiltinKloviPluginId("claude")).toBe(false);
    expect(isBuiltinKloviPluginId("")).toBe(false);
  });

  test("defines canonical npm package names", () => {
    expect(KLOVI_PLUGIN_PACKAGE_NAMES).toEqual({
      core: "@cookielab.io/klovi-plugin-core",
      claudeCode: "@cookielab.io/klovi-plugin-claude-code",
      codex: "@cookielab.io/klovi-plugin-codex",
      opencode: "@cookielab.io/klovi-plugin-opencode",
    });
  });
});
