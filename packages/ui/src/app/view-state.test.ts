import { encodeSessionId } from "@cookielab.io/klovi-plugin-core";
import type { KloviClient } from "../lib/client";
import { createRpcTimeoutError } from "../lib/rpc-errors";
import { getResumeCommand, restoreFromHash } from "./view-state";

const N_120000 = 120_000;

const baseProject = {
	encodedPath: "project-one",
	name: "workspace/project-one",
	fullPath: "/tmp/project-one",
	sessionCount: 1,
	lastActivity: "2026-03-10T10:00:00.000Z",
};

const baseSession = {
	sessionId: "session-1",
	timestamp: "2026-03-10T10:00:00.000Z",
	slug: "session-1",
	firstMessage: "Hello",
	model: "claude",
	gitBranch: "main",
};

function createClient(overrides: Partial<KloviClient> = {}): KloviClient {
	return {
		acceptRisks: () => Promise.resolve({ ok: true }),
		isFirstLaunch: () => Promise.resolve({ firstLaunch: false }),
		getVersion: () => Promise.resolve({ version: "test", commit: "abc123" }),
		getStats: () => Promise.resolve({ stats: {} as never, refreshing: false }),
		getProjects: () => Promise.resolve({ projects: [baseProject] }),
		getSessions: () => Promise.resolve({ sessions: [baseSession] }),
		getSession: () => Promise.resolve({ session: {} as never }),
		getSessionHead: () => Promise.resolve({ session: {} as never, totalTurns: 0 }),
		getSessionTail: () => Promise.resolve({ turns: [] }),
		getSubAgent: () => Promise.resolve({ session: {} as never }),
		searchSessions: () => Promise.resolve({ sessions: [] }),
		getPluginSettings: () => Promise.resolve({ plugins: [] }),
		updatePluginSetting: () => Promise.resolve({ plugins: [] }),
		getGeneralSettings: () => Promise.resolve({ showSecurityWarning: false }),
		updateGeneralSettings: () => Promise.resolve({ showSecurityWarning: false }),
		resetSettings: () => Promise.resolve({ ok: true }),
		...overrides,
	};
}

afterEach(() => {
	globalThis.location.hash = "#/";
});

describe("getResumeCommand", () => {
	it("returns plugin resume command for explicit plugin id", () => {
		expect(getResumeCommand("claude-code", encodeSessionId("claude-code", "abc123"))).toBe("claude --resume abc123");
		expect(getResumeCommand("codex-cli", encodeSessionId("codex-cli", "def456"))).toBe("codex resume def456");
	});

	it("uses plugin id encoded in session id when plugin id is missing", () => {
		expect(getResumeCommand(undefined, encodeSessionId("codex-cli", "xyz789"))).toBe("codex resume xyz789");
	});

	it("returns undefined when plugin has no resume command", () => {
		expect(getResumeCommand("opencode", encodeSessionId("opencode", "xyz789"))).toBeUndefined();
	});

	it("returns undefined for unknown plugin or unencoded session id", () => {
		expect(getResumeCommand("unknown-plugin", "raw-session-id")).toBeUndefined();
		expect(getResumeCommand(undefined, "raw-session-id")).toBeUndefined();
	});
});

describe("restoreFromHash", () => {
	it("returns restoring when project loading hits a transport timeout", async () => {
		globalThis.location.hash = "#/project-one";
		const view = await restoreFromHash(
			createClient({
				getProjects: () => Promise.reject(createRpcTimeoutError("getProjects", N_120000)),
			}),
		);

		expect(view).toEqual({ kind: "restoring", hash: "#/project-one" });
	});

	it("returns restoring when session loading hits a transport timeout", async () => {
		globalThis.location.hash = "#/project-one/session-1";
		const view = await restoreFromHash(
			createClient({
				getSessions: () => Promise.reject(createRpcTimeoutError("getSessions", N_120000)),
			}),
		);

		expect(view).toEqual({ kind: "restoring", hash: "#/project-one/session-1" });
	});

	it("returns home when project is missing", async () => {
		globalThis.location.hash = "#/missing-project";
		const view = await restoreFromHash(
			createClient({
				getProjects: () => Promise.resolve({ projects: [] }),
			}),
		);

		expect(view).toEqual({ kind: "home" });
	});

	it("returns project when session is missing", async () => {
		globalThis.location.hash = "#/project-one/missing-session";
		const view = await restoreFromHash(
			createClient({
				getSessions: () => Promise.resolve({ sessions: [] }),
			}),
		);

		expect(view).toEqual({ kind: "project", project: baseProject });
	});
});
