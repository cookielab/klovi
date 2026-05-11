import { Effect, Layer } from "effect";
import { maxIso, sortByIsoDesc } from "./iso-time";
import { PluginConfig, type PluginConfigShape } from "./plugin-config";
import type { RegistryRequirements } from "./plugin-runtime";
import type { MergedProject, PluginProject, RegistrySession, RegistrySessionSummary, ToolPlugin } from "./plugin-types";
import { resolveT3CodePaths } from "./resolve-worktree";
import { encodeSessionId } from "./session-id";

type SessionIdEncoder<TpluginId extends string> = (pluginId: TpluginId, rawSessionId: string) => string;

function encodeResolvedPath(resolvedPath: string): string {
	// Convert /Users/foo/bar -> -Users-foo-bar (same scheme as Claude Code)
	if (resolvedPath.startsWith("/")) {
		return resolvedPath.replace(/\//gu, "-");
	}

	return resolvedPath.replace(/[/\\:]/gu, "-");
}

type RegistryOptions<TpluginId extends string> = {
	encodeSessionId?: SessionIdEncoder<TpluginId>;
};

type RegisteredPlugin<
	TpluginId extends string,
	TsessionSummary extends RegistrySessionSummary,
	Tsession extends RegistrySession,
> = {
	plugin: ToolPlugin<TpluginId, TsessionSummary, Tsession>;
	config: PluginConfigShape;
	configLayer: Layer.Layer<PluginConfig>;
};

type DiscoveredPluginState<
	TpluginId extends string,
	TsessionSummary extends RegistrySessionSummary,
	Tsession extends RegistrySession,
> = {
	entry: RegisteredPlugin<TpluginId, TsessionSummary, Tsession>;
	projects: PluginProject<TpluginId>[];
	sessionsByNativeId?: Map<string, TsessionSummary[]>;
};

type DiscoveredProjectsWithSessions<TpluginId extends string, TsessionSummary extends RegistrySessionSummary> = {
	projects: MergedProject<TpluginId>[];
	sessionsByEncodedPath: Map<string, TsessionSummary[]>;
};

class PluginRegistry<
	TpluginId extends string = string,
	TsessionSummary extends RegistrySessionSummary = RegistrySessionSummary,
	Tsession extends RegistrySession = RegistrySession,
> {
	private readonly plugins = new Map<TpluginId, RegisteredPlugin<TpluginId, TsessionSummary, Tsession>>();

	private readonly sessionIdEncoder: SessionIdEncoder<TpluginId>;

	public constructor(options: RegistryOptions<TpluginId> = {}) {
		this.sessionIdEncoder =
			options.encodeSessionId ?? ((pluginId, rawSessionId) => encodeSessionId(pluginId, rawSessionId));
	}

	public register(plugin: ToolPlugin<TpluginId, TsessionSummary, Tsession>, config: PluginConfigShape): void {
		this.plugins.set(plugin.id, {
			plugin: plugin,
			config: config,
			configLayer: Layer.succeed(PluginConfig, config),
		});
	}

	public getPlugin(id: string): ToolPlugin<TpluginId, TsessionSummary, Tsession> {
		const entry = this.plugins.get(id as TpluginId);
		if (!entry) {
			throw new Error(`Plugin not found: ${id}`);
		}
		return entry.plugin;
	}

	public getPluginConfig(id: string): PluginConfigShape {
		const entry = this.plugins.get(id as TpluginId);
		if (!entry) {
			throw new Error(`Plugin not found: ${id}`);
		}
		return entry.config;
	}

	public getAllPlugins(): ToolPlugin<TpluginId, TsessionSummary, Tsession>[] {
		return [...this.plugins.values()].map((entry) => entry.plugin);
	}

	private discoverPluginStates(
		includeSessions: boolean,
	): Effect.Effect<DiscoveredPluginState<TpluginId, TsessionSummary, Tsession>[], never, RegistryRequirements> {
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
								Effect.catchAll(() => Effect.succeed([] as PluginProject<TpluginId>[])),
							));

						return {
							entry: entry,
							projects: projects,
							...(discoveredIndex ? { sessionsByNativeId: discoveredIndex.sessionsByNativeId } : {}),
						} as DiscoveredPluginState<TpluginId, TsessionSummary, Tsession>;
					}),
				{ concurrency: "unbounded" },
			);
		});
	}

	private mergeProjects(
		allProjects: PluginProject<TpluginId>[],
	): Effect.Effect<MergedProject<TpluginId>[], never, RegistryRequirements> {
		return Effect.gen(function* () {
			yield* resolveT3CodePaths(allProjects);

			const projectsByPath = new Map<string, PluginProject<TpluginId>[]>();
			for (const project of allProjects) {
				const current = projectsByPath.get(project.resolvedPath);
				if (current) {
					current.push(project);
				} else {
					projectsByPath.set(project.resolvedPath, [project]);
				}
			}

			const merged: MergedProject<TpluginId>[] = [];
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

	private encodeSessions(pluginId: TpluginId, sessions: TsessionSummary[]): TsessionSummary[] {
		return sessions.map(
			(session) =>
				({
					...session,
					sessionId: this.sessionIdEncoder(pluginId, session.sessionId),
					pluginId: pluginId,
				}) as TsessionSummary,
		);
	}

	private loadSourceSessions(
		state: DiscoveredPluginState<TpluginId, TsessionSummary, Tsession>,
		source: MergedProject<TpluginId>["sources"][number],
	): Effect.Effect<TsessionSummary[], never, RegistryRequirements> {
		const discoveredSessions = state.sessionsByNativeId?.get(source.nativeId);
		if (discoveredSessions) {
			return Effect.succeed(this.encodeSessions(source.pluginId, discoveredSessions));
		}

		return state.entry.plugin.listSessions(source.nativeId).pipe(
			Effect.provide(state.entry.configLayer),
			Effect.catchAll(() => Effect.succeed([] as TsessionSummary[])),
			Effect.map((sessions) => this.encodeSessions(source.pluginId, sessions)),
		);
	}

	public discoverAllProjects(): Effect.Effect<MergedProject<TpluginId>[], never, RegistryRequirements> {
		return Effect.gen(this, function* () {
			const states = yield* this.discoverPluginStates(false);
			return yield* this.mergeProjects(states.flatMap((state) => state.projects));
		});
	}

	public discoverAllProjectsWithSessions(): Effect.Effect<
		DiscoveredProjectsWithSessions<TpluginId, TsessionSummary>,
		never,
		RegistryRequirements
	> {
		return Effect.gen(this, function* () {
			const states = yield* this.discoverPluginStates(true);
			const mergedProjects = yield* this.mergeProjects(states.flatMap((state) => state.projects));
			const statesByPluginId = new Map(states.map((state) => [state.entry.plugin.id, state] as const));
			const sessionsByEncodedPath = new Map<string, TsessionSummary[]>();

			for (const project of mergedProjects) {
				const allSessions: TsessionSummary[] = [];

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

	public listAllSessions(
		project: MergedProject<TpluginId>,
	): Effect.Effect<TsessionSummary[], never, RegistryRequirements> {
		return Effect.gen(this, function* () {
			const allSessions: TsessionSummary[] = [];

			for (const source of project.sources) {
				const entry = this.plugins.get(source.pluginId);
				if (!entry) {
					continue;
				}

				allSessions.push(
					...(yield* entry.plugin.listSessions(source.nativeId).pipe(
						Effect.provide(entry.configLayer),
						Effect.catchAll(() => Effect.succeed([] as TsessionSummary[])),
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
