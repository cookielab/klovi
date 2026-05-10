import { join } from "node:path";
import type { Session, SessionSummary, ToolPlugin } from "@cookielab.io/klovi-plugin-core";
import { PluginConfig, PluginError } from "@cookielab.io/klovi-plugin-core";
import { FileSystem } from "@effect/platform";
import { Effect } from "effect";
import { discoverOpenCodeProjects, listOpenCodeSessions } from "./discovery";
import { loadOpenCodeSession } from "./parser";

export const openCodePlugin: ToolPlugin<string, SessionSummary, Session> = {
	id: "opencode",
	displayName: "OpenCode",
	getDefaultDataDir: () => null,
	isDataAvailable: Effect.gen(function* () {
		const config = yield* PluginConfig;
		const fs = yield* FileSystem.FileSystem;
		return yield* fs.exists(join(config.dataDir, "opencode.db")).pipe(Effect.catchAll(() => Effect.succeed(false)));
	}),
	discoverProjects: discoverOpenCodeProjects().pipe(
		Effect.catchAll((err) =>
			Effect.fail(
				new PluginError({
					pluginId: "opencode",
					operation: "discoverProjects",
					message: String(err),
					cause: err,
				}),
			),
		),
	),
	listSessions: (nativeId: string) =>
		listOpenCodeSessions(nativeId).pipe(
			Effect.catchAll((err) =>
				Effect.fail(
					new PluginError({
						pluginId: "opencode",
						operation: "listSessions",
						message: String(err),
						cause: err,
					}),
				),
			),
		),
	loadSession: (nativeId: string, sessionId: string) =>
		loadOpenCodeSession(nativeId, sessionId).pipe(
			Effect.catchAll((err) =>
				Effect.fail(
					new PluginError({
						pluginId: "opencode",
						operation: "loadSession",
						message: String(err),
						cause: err,
					}),
				),
			),
		),
	// No resume command — OpenCode doesn't have one
};

export { DEFAULT_OPENCODE_DIR, getOpenCodeDir, setOpenCodeDir } from "./config";
export { getOpenCodeDbPath, openOpenCodeDb } from "./db";
export { discoverOpenCodeProjects, listOpenCodeSessions } from "./discovery";
export { openCodeInputFormatters, openCodeSummaryExtractors } from "./extractors";
export { openCodeFrontendPlugin } from "./frontend";
export type { OpenCodeMessage } from "./parser";
export { buildOpenCodeTurns, loadOpenCodeSession } from "./parser";
export { BunSqliteLayer } from "./runtime/bun-sqlite";
export { NodeSqliteLayer } from "./runtime/node-sqlite";
