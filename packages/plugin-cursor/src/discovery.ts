import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type {
	PluginDiscoveryIndex,
	PluginProject,
	SessionSummary,
	SqliteClientTag,
	SqliteDb,
} from "@cookielab.io/klovi-plugin-core";
import { epochMsToIso, PluginConfig, sortByIsoDesc } from "@cookielab.io/klovi-plugin-core";
import type { FileSystem } from "@effect/platform";
import { Effect } from "effect";
import { encodeCursorProjectPath } from "./config";
import { getCursorWorkspaceStorageDirEffect, openCursorDbIfExists, openCursorGlobalDb } from "./db";
import { readPlanDisplayName } from "./plans";
import { fileExists, listFilesWithMtime, readDirEntriesSafe, readFileText } from "./shared/discovery-utils";
import { tryParseJson } from "./shared/json-utils";
import { iterateJsonl } from "./shared/jsonl-utils";
import { truncate } from "./shared/text-utils";
import type {
	CursorAgentSummary,
	CursorComposerSummary,
	CursorIndex,
	CursorPlanSummary,
	CursorSessionRecord,
} from "./types";

const SESSION_PREVIEW_MAX_LENGTH = 200;

type WorkspaceDescriptor = {
	projectPath: string;
	workspaceDbPath: string;
};

type WorkspaceJson = {
	folder?: string;
};

type WorkspaceComposerRegistry = {
	allComposers?: WorkspaceComposerEntry[];
};

type WorkspaceComposerEntry = {
	composerId?: string;
	name?: string;
	subtitle?: string;
	createdAt?: number;
	lastUpdatedAt?: number;
	unifiedMode?: string;
	forceMode?: string;
};

type CursorComposerData = {
	composerId?: string;
	name?: string;
	subtitle?: string;
	createdAt?: number;
	lastUpdatedAt?: number;
	unifiedMode?: string;
	forceMode?: string;
	fullConversationHeadersOnly?: CursorConversationHeader[];
	conversation?: CursorBubble[];
};

type CursorConversationHeader = {
	bubbleId?: string;
	type?: number;
};

type CursorBubble = {
	bubbleId?: string;
	type?: number;
	text?: string;
};

type CursorPlanRegistryEntry = {
	id?: string;
	name?: string;
	createdBy?: string;
	createdAt?: number;
	lastUpdatedAt?: number;
	uri?: {
		fsPath?: string;
	};
};

type ValueRow = {
	value: string;
};

type ComposerSummaryOptions = {
	resolveFirstMessage: boolean;
};

type BackgroundAgentDiscoveryOptions = {
	readPreviewText: boolean;
};

type PlanDiscoveryOptions = {
	loadDisplayName: boolean;
};

type AgentTranscriptFile = {
	agentId: string;
	filePath: string;
	mtimeIso: string;
};

type ComposerSummaryInput = {
	projectPath: string;
	workspaceDbPath: string;
	composer: WorkspaceComposerEntry;
	globalDb: SqliteDb | null;
	options?: ComposerSummaryOptions;
};

type CollectComposerSessionsInput = {
	workspaceDescriptors: readonly WorkspaceDescriptor[];
	globalDb: SqliteDb | null;
	sessionsByProject: Map<string, CursorSessionRecord[]>;
	composersById: Map<string, CursorComposerSummary>;
	options: ComposerSummaryOptions;
};

function isNonEmptyString(value: unknown): value is string {
	return typeof value === "string" && value.trim().length > 0;
}

function toIsoOrEmpty(epochMs: number | undefined): string {
	return typeof epochMs === "number" && Number.isFinite(epochMs) && epochMs > 0 ? epochMsToIso(epochMs) : "";
}

function fileUrlToPath(url: string): string | null {
	try {
		return fileURLToPath(url);
	} catch {
		return null;
	}
}

function querySingleValue(db: SqliteDb, sql: string, ...params: unknown[]): string | null {
	try {
		const row = db.query<ValueRow>(sql).get(...params);
		return typeof row?.value === "string" ? row.value : null;
	} catch {
		return null;
	}
}

function queryKeyValueRow(db: SqliteDb, key: string): string | null {
	return querySingleValue(db, "SELECT value FROM cursorDiskKV WHERE key = ?", key);
}

function queryItemTableRow(db: SqliteDb, key: string): string | null {
	return querySingleValue(db, "SELECT value FROM ItemTable WHERE key = ?", key);
}

function readWorkspaceComposerEntries(db: SqliteDb): WorkspaceComposerEntry[] {
	const rawValue = queryItemTableRow(db, "composer.composerData");
	if (!rawValue) {
		return [];
	}

	const parsed = tryParseJson<WorkspaceComposerRegistry>(rawValue);
	return Array.isArray(parsed?.allComposers) ? parsed.allComposers : [];
}

function extractBubbleUserText(bubble: CursorBubble | undefined): string {
	return isNonEmptyString(bubble?.text) ? bubble.text.trim() : "";
}

function extractFirstUserTextFromConversation(conversation: CursorBubble[] | undefined): string {
	if (!Array.isArray(conversation)) {
		return "";
	}

	for (const bubble of conversation) {
		if (bubble?.type !== 1) {
			continue;
		}
		const text = extractBubbleUserText(bubble);
		if (text) {
			return text;
		}
	}

	return "";
}

function extractFirstUserTextFromHeaders(
	db: SqliteDb,
	composerId: string,
	headers: CursorConversationHeader[] | undefined,
): string {
	if (!Array.isArray(headers)) {
		return "";
	}

	for (const header of headers) {
		if (!header?.bubbleId) {
			continue;
		}
		if (header.type !== undefined && header.type !== 1) {
			continue;
		}

		const rawBubble = queryKeyValueRow(db, `bubbleId:${composerId}:${header.bubbleId}`);
		if (!rawBubble) {
			continue;
		}

		const bubble = tryParseJson<CursorBubble>(rawBubble);
		const text = extractBubbleUserText(bubble);
		if (text) {
			return text;
		}
	}

	return "";
}

function resolveComposerFallbackMessage(composer: WorkspaceComposerEntry): string {
	if (isNonEmptyString(composer.name)) {
		return composer.name.trim();
	}
	if (isNonEmptyString(composer.subtitle)) {
		return composer.subtitle.trim();
	}
	return "Cursor session";
}

function resolveComposerFirstMessage(
	globalDb: SqliteDb | null,
	composer: WorkspaceComposerEntry,
	composerId: string,
): string {
	if (globalDb) {
		const rawComposerData = queryKeyValueRow(globalDb, `composerData:${composerId}`);
		const parsed = rawComposerData ? tryParseJson<CursorComposerData>(rawComposerData) : undefined;
		const fromConversation = extractFirstUserTextFromConversation(parsed?.conversation);
		if (fromConversation) {
			return truncate(fromConversation, SESSION_PREVIEW_MAX_LENGTH);
		}

		const fromHeaders = extractFirstUserTextFromHeaders(globalDb, composerId, parsed?.fullConversationHeadersOnly);
		if (fromHeaders) {
			return truncate(fromHeaders, SESSION_PREVIEW_MAX_LENGTH);
		}
	}

	return resolveComposerFallbackMessage(composer);
}

function resolveComposerSessionType(unifiedMode: string): SessionSummary["sessionType"] {
	if (unifiedMode === "plan") {
		return "plan";
	}
	if (unifiedMode === "agent") {
		return "implementation";
	}
	return undefined;
}

function createComposerSummary({
	projectPath,
	workspaceDbPath,
	composer,
	globalDb,
	options = { resolveFirstMessage: true },
}: ComposerSummaryInput): CursorComposerSummary | null {
	if (!isNonEmptyString(composer.composerId)) {
		return null;
	}

	const createdAtMs = typeof composer.createdAt === "number" ? composer.createdAt : 0;
	if (!createdAtMs) {
		return null;
	}

	const { composerId } = composer;
	const unifiedMode = composer.unifiedMode ?? composer.forceMode ?? "chat";
	const firstMessage = options.resolveFirstMessage
		? resolveComposerFirstMessage(globalDb, composer, composerId)
		: resolveComposerFallbackMessage(composer);

	return {
		kind: "composer",
		rawSessionId: `composer:${composerId}`,
		projectPath: projectPath,
		composerId: composerId,
		workspaceDbPath: workspaceDbPath,
		createdAtMs: createdAtMs,
		lastUpdatedAtMs: typeof composer.lastUpdatedAt === "number" ? composer.lastUpdatedAt : createdAtMs,
		name: composer.name?.trim() ?? "",
		subtitle: composer.subtitle?.trim() ?? "",
		unifiedMode: unifiedMode,
		timestamp: toIsoOrEmpty(createdAtMs),
		firstMessage: firstMessage,
		slug: composer.name?.trim() || composerId,
		model: "unknown",
		gitBranch: "",
		sessionType: resolveComposerSessionType(unifiedMode),
	};
}

function parseProjectPathFromWorkspaceJson(content: string): string | null {
	const parsed = tryParseJson<WorkspaceJson>(content);
	if (!isNonEmptyString(parsed?.folder)) {
		return null;
	}
	return fileUrlToPath(parsed.folder);
}

function discoverWorkspaceDescriptors(
	targetProjectPath?: string,
): Effect.Effect<WorkspaceDescriptor[], never, FileSystem.FileSystem> {
	return Effect.gen(function* () {
		const workspaceStorageDir = yield* getCursorWorkspaceStorageDirEffect();
		const workspaceEntries = yield* readDirEntriesSafe(workspaceStorageDir);
		const workspaceDescriptors: WorkspaceDescriptor[] = [];

		for (const entry of workspaceEntries) {
			if (!entry.isDirectory) {
				continue;
			}

			const workspaceDir = join(workspaceStorageDir, entry.name);
			const workspaceJsonPath = join(workspaceDir, "workspace.json");
			const workspaceDbPath = join(workspaceDir, "state.vscdb");
			const exists = yield* fileExists(workspaceJsonPath);
			if (!exists) {
				continue;
			}

			const projectPath = yield* readFileText(workspaceJsonPath).pipe(
				Effect.map(parseProjectPathFromWorkspaceJson),
				Effect.catchAll(() => Effect.succeed(null)),
			);
			if (!projectPath || (targetProjectPath && projectPath !== targetProjectPath)) {
				continue;
			}

			workspaceDescriptors.push({ projectPath: projectPath, workspaceDbPath: workspaceDbPath });
		}

		return workspaceDescriptors;
	});
}

function findProjectSessions(
	sessionsByProject: Map<string, CursorSessionRecord[]>,
	projectPath: string,
): CursorSessionRecord[] {
	const existing = sessionsByProject.get(projectPath);
	if (existing) {
		return existing;
	}
	const created: CursorSessionRecord[] = [];
	sessionsByProject.set(projectPath, created);
	return created;
}

function pushSession(sessionsByProject: Map<string, CursorSessionRecord[]>, session: CursorSessionRecord): void {
	findProjectSessions(sessionsByProject, session.projectPath).push(session);
}

function pushSessions(
	sessionsByProject: Map<string, CursorSessionRecord[]>,
	sessions: Iterable<CursorSessionRecord>,
): void {
	for (const session of sessions) {
		pushSession(sessionsByProject, session);
	}
}

function collectComposerSessions({
	workspaceDescriptors,
	globalDb,
	sessionsByProject,
	composersById,
	options,
}: CollectComposerSessionsInput): Effect.Effect<void, never, FileSystem.FileSystem | SqliteClientTag> {
	return Effect.gen(function* () {
		for (const descriptor of workspaceDescriptors) {
			const workspaceDb = yield* openCursorDbIfExists(descriptor.workspaceDbPath);
			if (!workspaceDb) {
				continue;
			}

			try {
				const composers = readWorkspaceComposerEntries(workspaceDb);
				for (const composer of composers) {
					const summary = createComposerSummary({
						projectPath: descriptor.projectPath,
						workspaceDbPath: descriptor.workspaceDbPath,
						composer: composer,
						globalDb: globalDb,
						options: options,
					});
					if (!summary) {
						continue;
					}

					composersById.set(summary.composerId, summary);
					pushSession(sessionsByProject, summary);
				}
			} finally {
				workspaceDb.close();
			}
		}
	});
}

function readFirstTranscriptUserMessage(text: string): string {
	let firstMessage = "";

	iterateJsonl(
		text,
		({ parsed }) => {
			const line = parsed as {
				role?: string;
				message?: { content?: Array<{ type?: string; text?: string }> };
			};
			if (line.role !== "user" || !Array.isArray(line.message?.content)) {
				return;
			}

			const parts = line.message.content
				.filter((block) => block?.type === "text" && isNonEmptyString(block.text))
				.map((block) => block.text?.trim() ?? "")
				.filter(Boolean);

			if (parts.length === 0) {
				return;
			}

			firstMessage = truncate(parts.join("\n\n"), SESSION_PREVIEW_MAX_LENGTH);
			return false;
		},
		{ onMalformed: () => undefined },
	);

	return firstMessage;
}

function listTranscriptFiles(
	agentTranscriptsDir: string,
): Effect.Effect<AgentTranscriptFile[], never, FileSystem.FileSystem> {
	return Effect.gen(function* () {
		const agentDirs = yield* readDirEntriesSafe(agentTranscriptsDir);
		const files: AgentTranscriptFile[] = [];

		for (const entry of agentDirs) {
			if (!entry.isDirectory) {
				continue;
			}

			const agentId = entry.name;
			const transcriptDir = join(agentTranscriptsDir, agentId);
			const transcriptFiles = yield* listFilesWithMtime(transcriptDir, ".jsonl");
			const transcript =
				transcriptFiles.find((candidate) => candidate.fileName === `${agentId}.jsonl`) ?? transcriptFiles[0];
			if (!transcript) {
				continue;
			}

			files.push({
				agentId: agentId,
				filePath: join(transcriptDir, transcript.fileName),
				mtimeIso: transcript.mtime,
			});
		}

		sortByIsoDesc(files, (item) => item.mtimeIso);
		return files;
	});
}

function createBackgroundAgentSummary(
	projectPath: string,
	transcript: AgentTranscriptFile,
	firstMessage: string,
): CursorAgentSummary {
	return {
		kind: "agent",
		rawSessionId: `agent:${transcript.agentId}`,
		projectPath: projectPath,
		agentId: transcript.agentId,
		filePath: transcript.filePath,
		timestamp: transcript.mtimeIso,
		timestampMs: new Date(transcript.mtimeIso).getTime(),
		firstMessage: firstMessage,
		slug: transcript.agentId,
		model: "unknown",
		gitBranch: "",
		sessionType: "implementation",
	};
}

function discoverBackgroundAgentsForProject(
	projectPath: string,
	options: BackgroundAgentDiscoveryOptions = { readPreviewText: true },
): Effect.Effect<Map<string, CursorAgentSummary>, never, PluginConfig | FileSystem.FileSystem> {
	return Effect.gen(function* () {
		const config = yield* PluginConfig;
		const agentTranscriptsDir = join(
			config.dataDir,
			"projects",
			encodeCursorProjectPath(projectPath),
			"agent-transcripts",
		);
		const agentsById = new Map<string, CursorAgentSummary>();
		const transcriptDirExists = yield* fileExists(agentTranscriptsDir);
		if (!transcriptDirExists) {
			return agentsById;
		}

		const transcripts = yield* listTranscriptFiles(agentTranscriptsDir);
		for (const transcript of transcripts) {
			let firstMessage = "Cursor background agent";
			if (options.readPreviewText) {
				const text = yield* readFileText(transcript.filePath).pipe(Effect.catchAll(() => Effect.succeed("")));
				firstMessage = readFirstTranscriptUserMessage(text) || firstMessage;
			}

			agentsById.set(transcript.agentId, createBackgroundAgentSummary(projectPath, transcript, firstMessage));
		}

		return agentsById;
	});
}

function discoverBackgroundAgents(
	projectPaths: readonly string[],
	options: BackgroundAgentDiscoveryOptions = { readPreviewText: true },
): Effect.Effect<Map<string, CursorAgentSummary>, never, PluginConfig | FileSystem.FileSystem> {
	return Effect.gen(function* () {
		const agentsById = new Map<string, CursorAgentSummary>();

		for (const projectPath of new Set(projectPaths)) {
			const projectAgents = yield* discoverBackgroundAgentsForProject(projectPath, options);
			for (const agent of projectAgents.values()) {
				agentsById.set(agent.agentId, agent);
			}
		}

		return agentsById;
	});
}

function parsePlanRegistry(rawValue: string | null): CursorPlanRegistryEntry[] {
	if (!rawValue) {
		return [];
	}

	const parsed = tryParseJson<Record<string, CursorPlanRegistryEntry>>(rawValue);
	if (!parsed) {
		return [];
	}

	return Object.values(parsed);
}

function createPlanSummary(
	entry: CursorPlanRegistryEntry,
	projectPath: string,
	filePath: string,
	displayName: string,
): CursorPlanSummary | null {
	if (!(isNonEmptyString(entry.id) && isNonEmptyString(entry.createdBy)) || typeof entry.createdAt !== "number") {
		return null;
	}

	return {
		kind: "plan",
		rawSessionId: `plan:${entry.id}`,
		projectPath: projectPath,
		planId: entry.id,
		filePath: filePath,
		createdAtMs: entry.createdAt,
		lastUpdatedAtMs: typeof entry.lastUpdatedAt === "number" ? entry.lastUpdatedAt : entry.createdAt,
		createdBy: entry.createdBy,
		timestamp: toIsoOrEmpty(entry.createdAt),
		firstMessage: displayName,
		slug: entry.id,
		model: "unknown",
		gitBranch: "",
		sessionType: "plan",
	};
}

type PlanLookupResult = {
	composer: CursorComposerSummary | undefined;
	agent: CursorAgentSummary | undefined;
	projectPath: string | undefined;
};

function lookupPlanOwner(
	entry: CursorPlanRegistryEntry,
	composersById: Map<string, CursorComposerSummary>,
	agentsById: Map<string, CursorAgentSummary>,
): PlanLookupResult {
	const composer = isNonEmptyString(entry.createdBy) ? composersById.get(entry.createdBy) : undefined;
	const agent = isNonEmptyString(entry.createdBy) ? agentsById.get(entry.createdBy) : undefined;
	const projectPath = composer?.projectPath ?? agent?.projectPath;
	return { composer: composer, agent: agent, projectPath: projectPath };
}

type ProcessPlanEntryArgs = {
	entry: CursorPlanRegistryEntry;
	composersById: Map<string, CursorComposerSummary>;
	agentsById: Map<string, CursorAgentSummary>;
	options: PlanDiscoveryOptions;
	plansById: Map<string, CursorPlanSummary>;
};

function processPlanEntry(args: ProcessPlanEntryArgs): Effect.Effect<void, never, FileSystem.FileSystem> {
	const { entry, composersById, agentsById, options, plansById } = args;
	return Effect.gen(function* () {
		const filePath = entry.uri?.fsPath;
		if (!isNonEmptyString(filePath)) {
			return;
		}

		const { agent, projectPath } = lookupPlanOwner(entry, composersById, agentsById);
		if (!projectPath) {
			return;
		}

		const exists = yield* fileExists(filePath);
		if (!exists) {
			return;
		}

		const displayName = options.loadDisplayName
			? yield* readPlanDisplayName(filePath).pipe(Effect.catchAll(() => Effect.succeed("")))
			: "";

		const summary = createPlanSummary(entry, projectPath, filePath, displayName || entry.name?.trim() || "Cursor plan");
		if (!summary) {
			return;
		}

		plansById.set(summary.planId, summary);
		if (agent) {
			agent.sessionType = "plan";
		}
	});
}

function discoverMappedPlans(
	globalDb: SqliteDb | null,
	composersById: Map<string, CursorComposerSummary>,
	agentsById: Map<string, CursorAgentSummary>,
	options: PlanDiscoveryOptions = { loadDisplayName: true },
): Effect.Effect<Map<string, CursorPlanSummary>, never, FileSystem.FileSystem> {
	return Effect.gen(function* () {
		const plansById = new Map<string, CursorPlanSummary>();
		if (!globalDb) {
			return plansById;
		}

		const entries = parsePlanRegistry(queryItemTableRow(globalDb, "composer.planRegistry"));
		for (const entry of entries) {
			yield* processPlanEntry({
				entry: entry,
				composersById: composersById,
				agentsById: agentsById,
				options: options,
				plansById: plansById,
			});
		}

		return plansById;
	});
}

function buildProjects(sessionsByProject: Map<string, CursorSessionRecord[]>): PluginProject[] {
	const projects: PluginProject[] = [];

	for (const [projectPath, sessions] of sessionsByProject) {
		if (sessions.length === 0) {
			continue;
		}

		sortByIsoDesc(sessions, (session) => session.timestamp);
		projects.push({
			pluginId: "cursor",
			nativeId: projectPath,
			resolvedPath: projectPath,
			displayName: projectPath,
			sessionCount: sessions.length,
			lastActivity: sessions[0]?.timestamp ?? "",
		});
	}

	sortByIsoDesc(projects, (project) => project.lastActivity);
	return projects;
}

function buildCursorProjectIndex(
	nativeId: string,
): Effect.Effect<CursorIndex, never, PluginConfig | FileSystem.FileSystem | SqliteClientTag> {
	return Effect.gen(function* () {
		const globalDb = yield* openCursorGlobalDb();
		const sessionsByProject = new Map<string, CursorSessionRecord[]>();
		const composersById = new Map<string, CursorComposerSummary>();

		try {
			const workspaceDescriptors = yield* discoverWorkspaceDescriptors(nativeId);
			yield* collectComposerSessions({
				workspaceDescriptors: workspaceDescriptors,
				globalDb: globalDb,
				sessionsByProject: sessionsByProject,
				composersById: composersById,
				options: { resolveFirstMessage: true },
			});

			const agentsById = yield* discoverBackgroundAgents([nativeId], { readPreviewText: true });
			pushSessions(sessionsByProject, agentsById.values());

			const plansById = yield* discoverMappedPlans(globalDb, composersById, agentsById, { loadDisplayName: true });
			pushSessions(sessionsByProject, plansById.values());

			return {
				projects: buildProjects(sessionsByProject),
				sessionsByProject: sessionsByProject,
				composersById: composersById,
				agentsById: agentsById,
				plansById: plansById,
			} satisfies CursorIndex;
		} finally {
			globalDb?.close();
		}
	});
}

function buildCursorIndex(): Effect.Effect<CursorIndex, never, PluginConfig | FileSystem.FileSystem | SqliteClientTag> {
	return Effect.gen(function* () {
		const globalDb = yield* openCursorGlobalDb();
		const sessionsByProject = new Map<string, CursorSessionRecord[]>();
		const composersById = new Map<string, CursorComposerSummary>();

		try {
			const workspaceDescriptors = yield* discoverWorkspaceDescriptors();
			const workspaceProjectPaths = [...new Set(workspaceDescriptors.map((descriptor) => descriptor.projectPath))];
			yield* collectComposerSessions({
				workspaceDescriptors: workspaceDescriptors,
				globalDb: globalDb,
				sessionsByProject: sessionsByProject,
				composersById: composersById,
				options: { resolveFirstMessage: true },
			});

			const agentsById = yield* discoverBackgroundAgents(workspaceProjectPaths);
			pushSessions(sessionsByProject, agentsById.values());

			const plansById = yield* discoverMappedPlans(globalDb, composersById, agentsById);
			pushSessions(sessionsByProject, plansById.values());

			return {
				projects: buildProjects(sessionsByProject),
				sessionsByProject: sessionsByProject,
				composersById: composersById,
				agentsById: agentsById,
				plansById: plansById,
			} satisfies CursorIndex;
		} finally {
			globalDb?.close();
		}
	});
}

function toSessionSummary(session: CursorSessionRecord): SessionSummary {
	return {
		sessionId: session.rawSessionId,
		timestamp: session.timestamp,
		slug: session.slug,
		firstMessage: session.firstMessage,
		model: session.model,
		gitBranch: session.gitBranch,
		pluginId: "cursor",
		sessionType: session.sessionType,
	};
}

function buildCursorDiscoveryIndex(): Effect.Effect<
	PluginDiscoveryIndex<string, SessionSummary>,
	never,
	PluginConfig | FileSystem.FileSystem | SqliteClientTag
> {
	return buildCursorIndex().pipe(
		Effect.map((index) => ({
			projects: index.projects,
			sessionsByNativeId: new Map(
				[...index.sessionsByProject.entries()].map(([projectPath, sessions]) => [
					projectPath,
					sessions.map(toSessionSummary),
				]),
			),
		})),
	);
}

function discoverCursorProjects(): Effect.Effect<
	PluginProject[],
	never,
	PluginConfig | FileSystem.FileSystem | SqliteClientTag
> {
	return Effect.gen(function* () {
		const globalDb = yield* openCursorGlobalDb();
		const sessionsByProject = new Map<string, CursorSessionRecord[]>();
		const composersById = new Map<string, CursorComposerSummary>();

		try {
			const workspaceDescriptors = yield* discoverWorkspaceDescriptors();
			const workspaceProjectPaths = [...new Set(workspaceDescriptors.map((descriptor) => descriptor.projectPath))];
			yield* collectComposerSessions({
				workspaceDescriptors: workspaceDescriptors,
				globalDb: globalDb,
				sessionsByProject: sessionsByProject,
				composersById: composersById,
				options: { resolveFirstMessage: false },
			});

			const agentsById = yield* discoverBackgroundAgents(workspaceProjectPaths, { readPreviewText: false });
			pushSessions(sessionsByProject, agentsById.values());

			const plansById = yield* discoverMappedPlans(globalDb, composersById, agentsById, {
				loadDisplayName: false,
			});
			pushSessions(sessionsByProject, plansById.values());

			return buildProjects(sessionsByProject);
		} finally {
			globalDb?.close();
		}
	});
}

function listCursorSessions(
	nativeId: string,
): Effect.Effect<SessionSummary[], never, PluginConfig | FileSystem.FileSystem | SqliteClientTag> {
	return buildCursorProjectIndex(nativeId).pipe(
		Effect.map((index) => {
			const sessions = index.sessionsByProject.get(nativeId) ?? [];
			sortByIsoDesc(sessions, (session) => session.timestamp);
			return sessions.map(toSessionSummary);
		}),
	);
}

function findCursorSession(index: CursorIndex, nativeId: string, sessionId: string): CursorSessionRecord | undefined {
	return (index.sessionsByProject.get(nativeId) ?? []).find((session) => session.rawSessionId === sessionId);
}

export {
	buildCursorDiscoveryIndex,
	buildCursorIndex,
	buildCursorProjectIndex,
	discoverCursorProjects,
	findCursorSession,
	listCursorSessions,
};
