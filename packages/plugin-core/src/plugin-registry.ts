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

export type SessionIdEncoder<TPluginId extends string> = (pluginId: TPluginId, rawSessionId: string) => string;

export function encodeResolvedPath(resolvedPath: string): string {
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

export class PluginRegistry<
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

	discoverAllProjects(): Effect.Effect<MergedProject<TPluginId>[], never, RegistryRequirements> {
		return Effect.gen(this, function* () {
			const allProjects: PluginProject<TPluginId>[] = [];

			for (const { plugin, configLayer } of this.plugins.values()) {
				const projects = yield* plugin.discoverProjects.pipe(
					Effect.provide(configLayer),
					Effect.catchAll(() => Effect.succeed([] as PluginProject<TPluginId>[])),
				);
				allProjects.push(...projects);
			}

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

	listAllSessions(project: MergedProject<TPluginId>): Effect.Effect<TSessionSummary[], never, RegistryRequirements> {
		return Effect.gen(this, function* () {
			const allSessions: TSessionSummary[] = [];

			for (const source of project.sources) {
				const entry = this.plugins.get(source.pluginId);
				if (!entry) {
					continue;
				}

				const sessions = yield* entry.plugin.listSessions(source.nativeId).pipe(
					Effect.provide(entry.configLayer),
					Effect.catchAll(() => Effect.succeed([] as TSessionSummary[])),
				);

				allSessions.push(
					...sessions.map(
						(session) =>
							({
								...session,
								sessionId: this.sessionIdEncoder(source.pluginId, session.sessionId),
								pluginId: source.pluginId,
							}) as TSessionSummary,
					),
				);
			}

			sortByIsoDesc(allSessions, (session) => session.timestamp);
			return allSessions;
		});
	}
}
