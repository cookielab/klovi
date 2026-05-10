import { encodeSessionId, parseSessionId } from "./session-id";

describe("session id codec", () => {
	it("encodes plugin and raw session id", () => {
		expect(encodeSessionId("claude-code", "abc")).toBe("claude-code::abc");
	});

	it("parses encoded session id", () => {
		expect(parseSessionId("codex-cli::session-1")).toEqual({
			pluginId: "codex-cli",
			rawSessionId: "session-1",
		});
	});

	it("treats unencoded id as raw session id", () => {
		expect(parseSessionId("session-plain")).toEqual({
			pluginId: null,
			rawSessionId: "session-plain",
		});
	});

	it("splits at first separator only", () => {
		expect(parseSessionId("opencode::nested::id")).toEqual({
			pluginId: "opencode",
			rawSessionId: "nested::id",
		});
	});
});
