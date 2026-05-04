import type {
	GlobalSessionResult,
	RegistryRequirements,
	Session,
	SessionSummary,
	Turn,
} from "@cookielab.io/klovi-plugin-core";
import { encodeSessionId, makePluginConfigLayer, parseSessionId, sortByIsoDesc } from "@cookielab.io/klovi-plugin-core";
import { Effect } from "effect";
import {
	InvalidSessionIdError,
	PluginSourceNotFoundError,
	ProjectNotFoundError,
	SubAgentNotSupportedError,
	type UnknownPluginError,
} from "./errors.ts";
import type { MergedProject } from "./plugin-types.ts";
import type { PluginRegistry } from "./registry.ts";

const DEFAULT_HEAD_SIZE = 100;

type ProjectsResponse = { projects: MergedProject[] };
type SessionsResponse = { sessions: SessionSummary[] };
type SessionResponse = { session: Session };
type SearchResponse = { sessions: GlobalSessionResult[] };
type SessionHeadResponse = {
	session: Session;
	totalTurns: number;
};
type SessionTailResponse = {
	turns: Turn[];
};

function getProjects(registry: PluginRegistry): Effect.Effect<ProjectsResponse, never, RegistryRequirements> {
	return Effect.gen(function* () {
		const projects = yield* registry.discoverAllProjects();
		return { projects: projects };
	});
}

function getSessions(
	registry: PluginRegistry,
	params: { encodedPath: string },
): Effect.Effect<SessionsResponse, never, RegistryRequirements> {
	return Effect.gen(function* () {
		const discovered = yield* registry.discoverAllProjectsWithSessions();
		if (!discovered.projects.some((project) => project.encodedPath === params.encodedPath)) {
			return { sessions: [] as SessionSummary[] };
		}
		return { sessions: discovered.sessionsByEncodedPath.get(params.encodedPath) ?? [] };
	});
}

type GetSessionError = InvalidSessionIdError | ProjectNotFoundError | PluginSourceNotFoundError;

function loadSessionInternal(
	registry: PluginRegistry,
	params: { sessionId: string; project: string },
): Effect.Effect<{ session: Session; pluginId: string; rawSessionId: string }, GetSessionError, RegistryRequirements> {
	return Effect.gen(function* () {
		const parsed = parseSessionId(params.sessionId);
		if (!(parsed.pluginId && parsed.rawSessionId)) {
			return yield* Effect.fail(new InvalidSessionIdError({ value: params.sessionId }));
		}

		const { pluginId } = parsed;
		const { rawSessionId } = parsed;

		const projects = yield* registry.discoverAllProjects();
		const project = projects.find((p) => p.encodedPath === params.project);
		if (!project) {
			return yield* Effect.fail(new ProjectNotFoundError({ encodedPath: params.project }));
		}

		const source = project.sources.find((s) => s.pluginId === pluginId);
		if (!source) {
			return yield* Effect.fail(new PluginSourceNotFoundError({ pluginId: pluginId, project: params.project }));
		}

		const plugin = registry.getPlugin(pluginId);
		const pluginConfig = registry.getPluginConfig(pluginId);
		const configLayer = makePluginConfigLayer(pluginConfig);

		const sessionDetail = plugin.loadSessionDetail
			? yield* plugin.loadSessionDetail(source.nativeId, rawSessionId).pipe(
					Effect.provide(configLayer),
					Effect.catchAll(() => Effect.succeed(undefined)),
				)
			: undefined;

		const session =
			sessionDetail?.session ??
			(yield* plugin.loadSession(source.nativeId, rawSessionId).pipe(
				Effect.provide(configLayer),
				Effect.catchAll(() => Effect.die("loadSession failed")),
			));

		session.sessionId = encodeSessionId(pluginId, rawSessionId);
		session.pluginId = pluginId;
		session.planSessionId = sessionDetail?.planSessionId
			? encodeSessionId(pluginId, sessionDetail.planSessionId)
			: undefined;
		session.implSessionId = sessionDetail?.implSessionId
			? encodeSessionId(pluginId, sessionDetail.implSessionId)
			: undefined;
		return { session: session, pluginId: pluginId, rawSessionId: rawSessionId };
	});
}

function getSession(
	registry: PluginRegistry,
	params: { sessionId: string; project: string },
): Effect.Effect<SessionResponse, GetSessionError, RegistryRequirements> {
	return loadSessionInternal(registry, params).pipe(Effect.map(({ session }) => ({ session: session })));
}

function getSessionHead(
	registry: PluginRegistry,
	params: { sessionId: string; project: string; headSize?: number },
): Effect.Effect<SessionHeadResponse, GetSessionError, RegistryRequirements> {
	return Effect.gen(function* () {
		const { session } = yield* loadSessionInternal(registry, params);
		const headSize = params.headSize ?? DEFAULT_HEAD_SIZE;
		const totalTurns = session.turns.length;
		const headSession: Session = { ...session, turns: session.turns.slice(0, headSize) };
		return { session: headSession, totalTurns: totalTurns };
	});
}

function getSessionTail(
	registry: PluginRegistry,
	params: { sessionId: string; project: string; fromTurn: number },
): Effect.Effect<SessionTailResponse, GetSessionError, RegistryRequirements> {
	return Effect.gen(function* () {
		const { session } = yield* loadSessionInternal(registry, params);
		const fromTurn = Math.max(0, params.fromTurn);
		const totalTurns = session.turns.length;
		return { turns: fromTurn >= totalTurns ? [] : session.turns.slice(fromTurn) };
	});
}

type GetSubAgentError = InvalidSessionIdError | UnknownPluginError | SubAgentNotSupportedError;

function getSubAgent(
	registry: PluginRegistry,
	params: { sessionId: string; project: string; agentId: string },
): Effect.Effect<SessionResponse, GetSubAgentError, RegistryRequirements> {
	return Effect.gen(function* () {
		const parsed = parseSessionId(params.sessionId);
		if (!(parsed.pluginId && parsed.rawSessionId)) {
			return yield* Effect.fail(new InvalidSessionIdError({ value: params.sessionId }));
		}

		const plugin = registry.getPlugin(parsed.pluginId);
		if (!plugin.loadSubAgentSession) {
			return yield* Effect.fail(new SubAgentNotSupportedError({ pluginId: parsed.pluginId }));
		}

		const pluginConfig = registry.getPluginConfig(parsed.pluginId);
		const configLayer = makePluginConfigLayer(pluginConfig);
		const session = yield* plugin
			.loadSubAgentSession({
				sessionId: parsed.rawSessionId,
				project: params.project,
				agentId: params.agentId,
			})
			.pipe(
				Effect.provide(configLayer),
				Effect.catchAll(() => Effect.die("loadSubAgentSession failed")),
			);
		return { session: session };
	});
}

function projectNameFromPath(fullPath: string): string {
	const parts = fullPath.split("/").filter(Boolean);
	return parts.slice(-2).join("/");
}

function searchSessions(registry: PluginRegistry): Effect.Effect<SearchResponse, never, RegistryRequirements> {
	return Effect.gen(function* () {
		const discovered = yield* registry.discoverAllProjectsWithSessions();

		const allSessions: GlobalSessionResult[] = [];
		for (const project of discovered.projects) {
			const sessions = discovered.sessionsByEncodedPath.get(project.encodedPath) ?? [];
			const projectName = projectNameFromPath(project.name);
			for (const session of sessions) {
				allSessions.push({
					...session,
					encodedPath: project.encodedPath,
					projectName: projectName,
				});
			}
		}

		sortByIsoDesc(allSessions, (session) => session.timestamp);
		return { sessions: allSessions };
	});
}

export type { SessionHeadResponse, SessionTailResponse };
export { getProjects, getSession, getSessionHead, getSessions, getSessionTail, getSubAgent, searchSessions };
