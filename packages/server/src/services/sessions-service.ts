import type {
	GlobalSessionResult,
	RegistryRequirements,
	Session,
	SessionSummary,
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

type ProjectsResponse = { projects: MergedProject[] };
type SessionsResponse = { sessions: SessionSummary[] };
type SessionResponse = { session: Session };
type SearchResponse = { sessions: GlobalSessionResult[] };

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
		const projects = yield* registry.discoverAllProjects();
		const project = projects.find((p) => p.encodedPath === params.encodedPath);
		if (!project) {
			return { sessions: [] as SessionSummary[] };
		}
		const sessions = yield* registry.listAllSessions(project);
		return { sessions: sessions };
	});
}

type GetSessionError = InvalidSessionIdError | ProjectNotFoundError | PluginSourceNotFoundError;

function getSession(
	registry: PluginRegistry,
	params: { sessionId: string; project: string },
): Effect.Effect<SessionResponse, GetSessionError, RegistryRequirements> {
	return Effect.gen(function* () {
		const parsed = parseSessionId(params.sessionId);
		if (!(parsed.pluginId && parsed.rawSessionId)) {
			return yield* Effect.fail(new InvalidSessionIdError({ value: params.sessionId }));
		}

		const pluginId = parsed.pluginId;
		const rawSessionId = parsed.rawSessionId;

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
		return { session: session };
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
		const projects = yield* registry.discoverAllProjects();
		const perProject = yield* Effect.forEach(
			projects,
			(project) =>
				registry.listAllSessions(project).pipe(Effect.map((sessions) => ({ project: project, sessions: sessions }))),
			{ concurrency: "unbounded" },
		);

		const allSessions: GlobalSessionResult[] = [];
		for (const { project, sessions } of perProject) {
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

export { getProjects, getSession, getSessions, getSubAgent, searchSessions };
