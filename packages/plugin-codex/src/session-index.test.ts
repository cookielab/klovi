import { mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PluginConfig } from "@cookielab.io/klovi-plugin-core";
import { NodeFileSystem } from "@effect/platform-node";
import { Effect, Layer } from "effect";
import { findCodexSessionFileById, isCodexSessionMeta, normalizeSessionMeta, scanCodexSessions } from "./session-index";


const N_1000 = 1000;
const N_2000 = 2000;
const N_1706000000 = 1_706_000_000;
const N_1706001000 = 1_706_001_000;
const N_1800000000 = 1_800_000_000;

const testDir = join(tmpdir(), `klovi-codex-session-index-test-${Date.now()}`);

const testLayer = Layer.mergeAll(NodeFileSystem.layer, Layer.succeed(PluginConfig, { dataDir: testDir }));

beforeEach(async () => {
	await mkdir(join(testDir, "sessions"), { recursive: true });
});

afterEach(async () => {
	await rm(testDir, { recursive: true, force: true });
});

describe("isCodexSessionMeta", () => {
	it("returns true for valid old-format meta", () => {
		expect(
			isCodexSessionMeta({
				uuid: "test",
				cwd: "/tmp",
				timestamps: { created: N_1000, updated: N_2000 },
				model: "o4-mini",
				["provider_id"]: "openai",
			}),
		).toBe(true);
	});

	it("returns false for new-format envelope", () => {
		expect(
			isCodexSessionMeta({
				type: "session_meta",
				payload: { id: "test", cwd: "/tmp" },
			}),
		).toBe(false);
	});

	it("returns false for non-object", () => {
		expect(isCodexSessionMeta("string")).toBe(false);
		expect(isCodexSessionMeta(null)).toBe(false);
	});
});

describe("normalizeSessionMeta", () => {
	it("passes through old-format meta unchanged", () => {
		const meta = {
			uuid: "old-uuid",
			cwd: "/tmp/project",
			timestamps: { created: N_1706000000, updated: N_1706001000 },
			model: "o4-mini",
			["provider_id"]: "openai",
		};
		const result = normalizeSessionMeta(meta);
		expect(result).toEqual(meta);
	});

	it("normalizes new-format envelope to CodexSessionMeta", () => {
		const newFormat = {
			type: "session_meta",
			timestamp: "2026-02-18T10:00:00.000Z",
			payload: {
				id: "new-uuid",
				cwd: "/tmp/project",
				timestamp: "2026-02-18T10:00:00.000Z",
				["model_provider"]: "openai",
				model: "o4-mini",
			},
		};

		const result = normalizeSessionMeta(newFormat);

		expect(result).not.toBeNull();
		expect(result?.uuid).toBe("new-uuid");
		expect(result?.cwd).toBe("/tmp/project");
		expect(result?.model).toBe("o4-mini");
		expect(result?.provider_id).toBe("openai");
		expect(result?.timestamps.created).toBeCloseTo(new Date("2026-02-18T10:00:00.000Z").getTime() / N_1000, 0);
	});

	it("uses unknown as model when model absent", () => {
		const newFormat = {
			type: "session_meta",
			payload: {
				id: "uuid",
				cwd: "/tmp",
				timestamp: "2026-02-18T10:00:00.000Z",
				["model_provider"]: "anthropic",
			},
		};

		const result = normalizeSessionMeta(newFormat);
		expect(result?.model).toBe("unknown");
		expect(result?.provider_id).toBe("anthropic");
	});

	it("uses file mtime as updated timestamp", () => {
		const newFormat = {
			type: "session_meta",
			payload: {
				id: "uuid",
				cwd: "/tmp",
				timestamp: "2026-02-18T10:00:00.000Z",
				["model_provider"]: "openai",
			},
		};

		const fileMtime = N_1800000000;
		const result = normalizeSessionMeta(newFormat, fileMtime);
		expect(result?.timestamps.updated).toBe(fileMtime);
	});

	it("returns null for unrecognized format", () => {
		expect(normalizeSessionMeta({ random: "object" })).toBeNull();
		expect(normalizeSessionMeta("string")).toBeNull();
		expect(normalizeSessionMeta(null)).toBeNull();
	});
});

describe("findCodexSessionFileById", () => {
	it("finds old-format file by exact uuid match", async () => {
		const dir = join(testDir, "sessions", "openai", "2025-01-15");
		await mkdir(dir, { recursive: true });
		await Bun.write(join(dir, "my-uuid.jsonl"), "{}");

		const result = await Effect.runPromise(findCodexSessionFileById("my-uuid").pipe(Effect.provide(testLayer)));
		expect(result).toBe(join(dir, "my-uuid.jsonl"));
	});

	it("finds new-format file by suffix match", async () => {
		const dir = join(testDir, "sessions", "2026", "02", "18");
		await mkdir(dir, { recursive: true });
		await Bun.write(join(dir, "rollout-2026-02-18-my-uuid.jsonl"), "{}");

		const result = await Effect.runPromise(findCodexSessionFileById("my-uuid").pipe(Effect.provide(testLayer)));
		expect(result).toBe(join(dir, "rollout-2026-02-18-my-uuid.jsonl"));
	});

	it("returns null when no file matches", async () => {
		const result = await Effect.runPromise(findCodexSessionFileById("nonexistent").pipe(Effect.provide(testLayer)));
		expect(result).toBeNull();
	});
});

describe("scanCodexSessions", () => {
	it("scans new-format session files", async () => {
		const dir = join(testDir, "sessions", "2026", "02", "18");
		await mkdir(dir, { recursive: true });
		await Bun.write(
			join(dir, "rollout-2026-02-18-scan-uuid.jsonl"),
			JSON.stringify({
				type: "session_meta",
				timestamp: "2026-02-18T10:00:00.000Z",
				payload: {
					id: "scan-uuid",
					cwd: "/tmp/project",
					timestamp: "2026-02-18T10:00:00.000Z",
					["model_provider"]: "openai",
					model: "o4-mini",
				},
			}),
		);

		const sessions = await Effect.runPromise(scanCodexSessions().pipe(Effect.provide(testLayer)));

		expect(sessions).toHaveLength(1);
		expect(sessions[0]?.meta.uuid).toBe("scan-uuid");
		expect(sessions[0]?.meta.cwd).toBe("/tmp/project");
		expect(sessions[0]?.meta.model).toBe("o4-mini");
	});

	it("uses turn_context model when new-format meta has no model", async () => {
		const dir = join(testDir, "sessions", "2026", "02", "18");
		await mkdir(dir, { recursive: true });
		await Bun.write(
			join(dir, "rollout-2026-02-18-turn-context-model.jsonl"),
			[
				JSON.stringify({
					type: "session_meta",
					timestamp: "2026-02-18T10:00:00.000Z",
					payload: {
						id: "turn-context-model-uuid",
						cwd: "/tmp/project",
						timestamp: "2026-02-18T10:00:00.000Z",
						["model_provider"]: "openai",
					},
				}),
				JSON.stringify({
					type: "turn_context",
					timestamp: "2026-02-18T10:00:01.000Z",
					payload: {
						model: "gpt-5.3-codex",
					},
				}),
			].join("\n"),
		);

		const sessions = await Effect.runPromise(scanCodexSessions().pipe(Effect.provide(testLayer)));

		expect(sessions).toHaveLength(1);
		expect(sessions[0]?.meta.model).toBe("gpt-5.3-codex");
	});

	it("falls back to provider when new-format meta has no model", async () => {
		const dir = join(testDir, "sessions", "2026", "02", "18");
		await mkdir(dir, { recursive: true });
		await Bun.write(
			join(dir, "rollout-2026-02-18-provider-model.jsonl"),
			JSON.stringify({
				type: "session_meta",
				timestamp: "2026-02-18T10:00:00.000Z",
				payload: {
					id: "provider-model-uuid",
					cwd: "/tmp/project",
					timestamp: "2026-02-18T10:00:00.000Z",
					["model_provider"]: "openai",
				},
			}),
		);

		const sessions = await Effect.runPromise(scanCodexSessions().pipe(Effect.provide(testLayer)));

		expect(sessions).toHaveLength(1);
		expect(sessions[0]?.meta.model).toBe("openai");
	});
});
