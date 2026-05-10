import type { Session, SessionSummary, ToolPlugin } from "@cookielab.io/klovi-plugin-core";
import { PluginConfig, PluginError } from "@cookielab.io/klovi-plugin-core";
import { FileSystem } from "@effect/platform";
import { Effect } from "effect";
import { getCursorGlobalDbPath, getCursorWorkspaceStorageDir } from "./config";
import { buildCursorDiscoveryIndex, discoverCursorProjects, listCursorSessions } from "./discovery";
import { loadCursorSession } from "./parser";
import { fileExists } from "./shared/discovery-utils";

export const cursorPlugin: ToolPlugin<string, SessionSummary, Session> = {
	id: "cursor",
	displayName: "Cursor",
	getDefaultDataDir: () => null,
	isDataAvailable: Effect.gen(function* () {
		const config = yield* PluginConfig;
		const fs = yield* FileSystem.FileSystem;

		const userDataExists = yield* fileExists(config.dataDir).pipe(Effect.catchAll(() => Effect.succeed(false)));
		if (userDataExists) {
			return true;
		}

		const globalDbExists = yield* fs.exists(getCursorGlobalDbPath()).pipe(Effect.catchAll(() => Effect.succeed(false)));
		if (globalDbExists) {
			return true;
		}

		return yield* fs.exists(getCursorWorkspaceStorageDir()).pipe(Effect.catchAll(() => Effect.succeed(false)));
	}),
	discoverProjects: discoverCursorProjects().pipe(
		Effect.catchAll((err) =>
			Effect.fail(
				new PluginError({
					pluginId: "cursor",
					operation: "discoverProjects",
					message: String(err),
					cause: err,
				}),
			),
		),
	),
	discoverIndex: buildCursorDiscoveryIndex().pipe(
		Effect.catchAll((err) =>
			Effect.fail(
				new PluginError({
					pluginId: "cursor",
					operation: "discoverIndex",
					message: String(err),
					cause: err,
				}),
			),
		),
	),
	listSessions: (nativeId: string) =>
		listCursorSessions(nativeId).pipe(
			Effect.catchAll((err) =>
				Effect.fail(
					new PluginError({
						pluginId: "cursor",
						operation: "listSessions",
						message: String(err),
						cause: err,
					}),
				),
			),
		),
	loadSession: (nativeId: string, sessionId: string) =>
		loadCursorSession(nativeId, sessionId).pipe(
			Effect.catchAll((err) =>
				Effect.fail(
					new PluginError({
						pluginId: "cursor",
						operation: "loadSession",
						message: String(err),
						cause: err,
					}),
				),
			),
		),
};

export {
	DEFAULT_CURSOR_DIR,
	encodeCursorProjectPath,
	getCursorAppSupportRoot,
	getCursorDir,
	getCursorGlobalDbPath,
	getCursorWorkspaceStorageDir,
	getDefaultCursorDir,
	setCursorDir,
} from "./config";
export { openCursorDbIfExists, openCursorGlobalDb } from "./db";
export {
	buildCursorDiscoveryIndex,
	buildCursorIndex,
	discoverCursorProjects,
	listCursorSessions,
} from "./discovery";
export { cursorFrontendPlugin } from "./frontend";
export { buildTurnsFromBubbles, loadCursorSession } from "./parser";
export { loadCursorPlanSession, parsePlanFrontmatter } from "./plans";
export type { CursorAgentSummary, CursorComposerSummary, CursorIndex, CursorPlanSummary } from "./types";
