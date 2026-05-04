import { Effect, Layer } from "effect";
import { maxIso, sortByIsoDesc } from "./iso-time.ts";
import { PluginConfig, type PluginConfigShape } from "./plugin-config.ts";
import type { RegistryRequirements } from "./plugin-runtime.ts";
import type {
	MergedProject,
	PluginProject,
	RegistrySession,
	RegistrySessionSummary,
	ToolPlugin,
} from "./plugin-types.ts";
import { resolveT3CodePaths } from "./resolve-worktree.ts";
import { encodeSessionId } from "./session-id.ts";

type SessionIdEncoder<TPluginId extends string> = (pluginId: TPluginId, rawSessionId: string) => string;

function encodeResolvedPath(resolvedPath: string): string {
	// Convert /Users/foo/bar -> -Users-foo-bar (same scheme as Claude Code)
	if (resolvedPath.startsWith("/")) {
		return resolvedPath.replace(/\//gu, "-");
	}

	return resolvedPath.replace(/[/\\:]/gu, "-");
}

type RegistryOptions<TPluginId extends string> = {
	encodeSessionId?: SessionIdEncoder<TPluginId>;
};

type RegisteredPlugin<
	TPluginId extends string,
	TSessionSummary extends RegistrySessionSummary,
	TSession extends RegistrySession,
> = {
	plugin: ToolPlugin<TPluginId, TSessionSummary, TSession>;
	config: PluginConfigShape;
	configLayer: Layer.Layer<PluginConfig>;
};

type DiscoveredPluginState<
	TPluginId extends string,
	TSessionSummary extends RegistrySessionSummary,
	TSession extends RegistrySession,
> = {
	entry: RegisteredPlugin<TPluginId, TSessionSummary, TSession>;
	projects: PluginProject<TPluginId>[];
	sessionsByNativeId?: Map<string, TSessionSummary[]>;
};

type DiscoveredProjectsWithSessions<TPluginId extends string, TSessionSummary extends RegistrySessionSummary> = {
	projects: MergedProject<TPluginId>[];
	sessionsByEncodedPath: Map<string, TSessionSummary[]>;
};

class PluginRegistry<
	TPluginId extends string = string,
	TSessionSummary extends RegistrySessionSummary = RegistrySessionSummary,
	TSession extends RegistrySession = RegistrySession,
> {
	private readonly plugins = new Map<TPluginId, RegisteredPlugin<TPluginId, TSessionSummary, TSession>>();

	private readonly sessionIdEncoder: SessionIdEncoder<TPluginId>;

	constructor(options: RegistryOptions<TPluginId> = {}) {
		this.sessionIdEncoder =
			options.encodeSessionId ?? ((pluginId, rawSessionId) => encodeSessionId(pluginId, rawSessionId));
	}

	register(plugin: ToolPlugin<TPluginId, TSessionSummary, TSession>, config: PluginConfigShape): void {
		this.plugins.set(plugin.id, {
			plugin: plugin,
			config: config,
			configLayer: Layer.succeed(PluginConfig, config),
		});
	}

	getPlugin(id: string): ToolPlugin<TPluginId, TSessionSummary, TSession> {
		const entry = this.plugins.get(id as TPluginId);
		if (!entry) {
			throw new Error(`Plugin not found: ${id}`);
		}
		return entry.plugin;
	}

	getPluginConfig(id: string): PluginConfigShape {
		const entry = this.plugins.get(id as TPluginId);
		if (!entry) {
			throw new Error(`Plugin not found: ${id}`);
		}
		return entry.config;
	}

	getAllPlugins(): ToolPlugin<TPluginId, TSessionSummary, TSession>[] {
		return [...this.plugins.values()].map((entry) => entry.plugin);
	}

	private discoverPluginStates(
		includeSessions: boolean,
	): Effect.Effect<DiscoveredPluginState<TPluginId, TSessionSummary, TSession>[], never, RegistryRequirements> {
		return Effect.gen(this, function* () {
			const entries = [...this.plugins.values()];
			return yield* Effect.forEach(
				entries,
				(entry) =>
					Effect.gen(function* () {
						const discoveredIndex =
							includeSessions && entry.plugin.discoverIndex
								? yield* entry.plugin.discoverIndex.pipe(
										Effect.provide(entry.configLayer),
										Effect.catchAll(() => Effect.succeed(undefined)),
									)
								: undefined;

						const projects =
							discoveredIndex?.projects ??
							(yield* entry.plugin.discoverProjects.pipe(
								Effect.provide(entry.configLayer),
								Effect.catchAll(() => Effect.succeed([] as PluginProject<TPluginId>[])),
							));

						return {
							entry: entry,
							projects: projects,
							...(discoveredIndex ? { sessionsByNativeId: discoveredIndex.sessionsByNativeId } : {}),
						} as DiscoveredPluginState<TPluginId, TSessionSummary, TSession>;
					}),
				{ concurrency: "unbounded" },
			);
		});
	}

	private mergeProjects(
		allProjects: PluginProject<TPluginId>[],
	): Effect.Effect<MergedProject<TPluginId>[], never, RegistryRequirements> {
		return Effect.gen(function* () {
			yield* resolveT3CodePaths(allProjects);

			const projectsByPath = new Map<string, PluginProject<TPluginId>[]>();
			for (const project of allProjects) {
				const current = projectsByPath.get(project.resolvedPath);
				if (current) {
					current.push(project);
				} else {
					projectsByPath.set(project.resolvedPath, [project]);
				}
			}

			const merged: MergedProject<TPluginId>[] = [];
			for (const [resolvedPath, projects] of projectsByPath) {
				merged.push({
					encodedPath: encodeResolvedPath(resolvedPath),
					resolvedPath: resolvedPath,
					name: resolvedPath,
					fullPath: resolvedPath,
					sessionCount: projects.reduce((sum, project) => sum + project.sessionCount, 0),
					lastActivity: maxIso(projects.map((project) => project.lastActivity)),
					sources: projects.map((project) => ({
						pluginId: project.pluginId,
						nativeId: project.nativeId,
					})),
				});
			}

			sortByIsoDesc(merged, (project) => project.lastActivity);
			return merged;
		});
	}

	private encodeSessions(pluginId: TPluginId, sessions: TSessionSummary[]): TSessionSummary[] {
		return sessions.map(
			(session) =>
				({
					...session,
					sessionId: this.sessionIdEncoder(pluginId, session.sessionId),
					pluginId: pluginId,
				}) as TSessionSummary,
		);
	}

	private loadSourceSessions(
		state: DiscoveredPluginState<TPluginId, TSessionSummary, TSession>,
		source: MergedProject<TPluginId>["sources"][number],
	): Effect.Effect<TSessionSummary[], never, RegistryRequirements> {
		const discoveredSessions = state.sessionsByNativeId?.get(source.nativeId);
		if (discoveredSessions) {
			return Effect.succeed(this.encodeSessions(source.pluginId, discoveredSessions));
		}

		return state.entry.plugin.listSessions(source.nativeId).pipe(
			Effect.provide(state.entry.configLayer),
			Effect.catchAll(() => Effect.succeed([] as TSessionSummary[])),
			Effect.map((sessions) => this.encodeSessions(source.pluginId, sessions)),
		);
	}

	discoverAllProjects(): Effect.Effect<MergedProject<TPluginId>[], never, RegistryRequirements> {
		return Effect.gen(this, function* () {
			const states = yield* this.discoverPluginStates(false);
			return yield* this.mergeProjects(states.flatMap((state) => state.projects));
		});
	}

	discoverAllProjectsWithSessions(): Effect.Effect<
		DiscoveredProjectsWithSessions<TPluginId, TSessionSummary>,
		never,
		RegistryRequirements
	> {
		return Effect.gen(this, function* () {
			const states = yield* this.discoverPluginStates(true);
			const mergedProjects = yield* this.mergeProjects(states.flatMap((state) => state.projects));
			const statesByPluginId = new Map(states.map((state) => [state.entry.plugin.id, state] as const));
			const sessionsByEncodedPath = new Map<string, TSessionSummary[]>();

			for (const project of mergedProjects) {
				const allSessions: TSessionSummary[] = [];

				for (const source of project.sources) {
					const state = statesByPluginId.get(source.pluginId);
					if (!state) {
						continue;
					}

					allSessions.push(...(yield* this.loadSourceSessions(state, source)));
				}

				sortByIsoDesc(allSessions, (session) => session.timestamp);
				sessionsByEncodedPath.set(project.encodedPath, allSessions);
			}

			return {
				projects: mergedProjects,
				sessionsByEncodedPath: sessionsByEncodedPath,
			};
		});
	}

	listAllSessions(project: MergedProject<TPluginId>): Effect.Effect<TSessionSummary[], never, RegistryRequirements> {
		return Effect.gen(this, function* () {
			const allSessions: TSessionSummary[] = [];

			for (const source of project.sources) {
				const entry = this.plugins.get(source.pluginId);
				if (!entry) {
					continue;
				}

				allSessions.push(
					...(yield* entry.plugin.listSessions(source.nativeId).pipe(
						Effect.provide(entry.configLayer),
						Effect.catchAll(() => Effect.succeed([] as TSessionSummary[])),
						Effect.map((sessions) => this.encodeSessions(source.pluginId, sessions)),
					)),
				);
			}

			sortByIsoDesc(allSessions, (session) => session.timestamp);
			return allSessions;
		});
	}
}

export type { SessionIdEncoder };
export { encodeResolvedPath, PluginRegistry };
