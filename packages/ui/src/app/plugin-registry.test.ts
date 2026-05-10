import { getFrontendPlugin } from "./plugin-registry";

describe("frontend plugin registry", () => {
	it("registers built-in frontend plugins from packages", () => {
		const claude = getFrontendPlugin("claude-code");
		const codex = getFrontendPlugin("codex-cli");
		const opencode = getFrontendPlugin("opencode");
		const cursor = getFrontendPlugin("cursor");

		expect(claude?.displayName).toBe("Claude Code");
		expect(codex?.displayName).toBe("Codex");
		expect(opencode?.displayName).toBe("OpenCode");
		expect(cursor?.displayName).toBe("Cursor");
	});

	it("uses plugin-provided resume commands", () => {
		expect(getFrontendPlugin("claude-code")?.getResumeCommand?.("abc123")).toBe("claude --resume abc123");
		expect(getFrontendPlugin("codex-cli")?.getResumeCommand?.("abc123")).toBe("codex resume abc123");
		expect(getFrontendPlugin("opencode")?.getResumeCommand).toBeUndefined();
		expect(getFrontendPlugin("cursor")?.getResumeCommand).toBeUndefined();
	});

	it("returns undefined for unknown plugin", () => {
		expect(getFrontendPlugin("unknown-plugin")).toBeUndefined();
	});
});
