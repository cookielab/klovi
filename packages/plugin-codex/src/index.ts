import type { Session, SessionSummary, ToolPlugin } from "@cookielab.io/klovi-plugin-core";
import { PluginConfig, PluginError } from "@cookielab.io/klovi-plugin-core";
import { Effect } from "effect";
import { discoverCodexProjects, listCodexSessions } from "./discovery";
import { loadCodexSession } from "./parser";
import { fileExists } from "./shared/discovery-utils";

export const codexCliPlugin: ToolPlugin<string, SessionSummary, Session> = {
	id: "codex-cli",
	displayName: "Codex",
	getDefaultDataDir: () => null,
	isDataAvailable: Effect.gen(function* () {
		const config = yield* PluginConfig;
		return yield* fileExists(config.dataDir).pipe(Effect.catchAll(() => Effect.succeed(false)));
	}),
	discoverProjects: discoverCodexProjects(),
	listSessions: (nativeId: string) => listCodexSessions(nativeId),
	loadSession: (nativeId: string, sessionId: string) =>
		loadCodexSession(nativeId, sessionId).pipe(
			Effect.catchAll((err) =>
				Effect.fail(
					new PluginError({
						pluginId: "codex-cli",
						operation: "loadSession",
						message: String(err),
						cause: err,
					}),
				),
			),
		),
	getResumeCommand: (sessionId: string) => `codex resume ${sessionId}`,
};

export { DEFAULT_CODEX_CLI_DIR, getCodexCliDir, setCodexCliDir } from "./config";
export { discoverCodexProjects, listCodexSessions } from "./discovery";
export { codexInputFormatters, codexSummaryExtractors } from "./extractors";
export { codexFrontendPlugin } from "./frontend";
export type { CodexEvent } from "./parser";
export { buildCodexTurns, loadCodexSession } from "./parser";
export type { CodexSessionMeta, SessionFileInfo } from "./session-index";
export {
	findCodexSessionFileById,
	isCodexSessionMeta,
	normalizeSessionMeta,
	scanCodexSessions,
} from "./session-index";
