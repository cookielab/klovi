import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { RegistryRequirements } from "@cookielab.io/klovi-plugin-core";
import type { FileSystem } from "@effect/platform";
import { BunContext } from "@effect/platform-bun";
import { Effect, Layer } from "effect";
import { getDefaultSettings, saveSettings as saveSettingsEffect } from "../services/settings.ts";
import { BunPluginLayer } from "./platform-bun.ts";
import { ServerConfig } from "./server-config.ts";
import { KloviServices, KloviServicesLive } from "./server-services.ts";

function saveSettings(path: string, settings: Parameters<typeof saveSettingsEffect>[1]) {
	return Effect.runPromise(saveSettingsEffect(path, settings).pipe(Effect.provide(BunContext.layer)));
}

async function runService<A, E>(
	effect: Effect.Effect<A, E, RegistryRequirements | FileSystem.FileSystem>,
): Promise<A> {
	const exit = await Effect.runPromiseExit(effect.pipe(Effect.provide(BunPluginLayer)));
	if (exit._tag === "Success") {
		return exit.value;
	}
	const stack: unknown[] = [exit.cause];
	while (stack.length > 0) {
		const node = stack.pop() as {
			_tag?: string;
			error?: unknown;
			defect?: unknown;
			left?: unknown;
			right?: unknown;
		};
		if (node._tag === "Fail") {
			const failure = node.error as { _tag?: string; pluginId?: string };
			if (failure._tag === "UnknownPluginError") {
				throw new Error(`Unknown plugin: ${failure.pluginId}`);
			}
			throw failure instanceof Error ? failure : new Error(String(failure));
		}
		if (node._tag === "Die") {
			throw node.defect instanceof Error ? node.defect : new Error(String(node.defect));
		}
		if (node.left !== undefined) {
			stack.push(node.left);
		}
		if (node.right !== undefined) {
			stack.push(node.right);
		}
	}
	throw new Error(String(exit.cause));
}

const testDir = join(tmpdir(), `klovi-services-test-${Date.now()}`);
const settingsPath = join(testDir, "settings.json");

function makeTestLayer() {
	const configLayer = Layer.succeed(ServerConfig, {
		host: "127.0.0.1",
		port: 0,
		settingsPath: settingsPath,
		version: "1.0.0",
		commit: "test",
	});
	return KloviServicesLive.pipe(Layer.provide(configLayer), Layer.provide(BunPluginLayer));
}

function runWithServices<A>(fn: (services: Effect.Effect.Success<typeof KloviServices>) => A | Promise<A>): Promise<A> {
	const program = Effect.gen(function* () {
		const services = yield* KloviServices;
		return yield* Effect.promise(() => Promise.resolve(fn(services)));
	});
	return Effect.runPromise(program.pipe(Effect.provide(makeTestLayer())));
}

describe("KloviServicesLive registry refresh", () => {
	afterEach(async () => {
		await rm(testDir, { recursive: true, force: true });
	});

	test("initial registry reflects startup settings", async () => {
		await mkdir(testDir, { recursive: true });
		const settings = getDefaultSettings();
		// Disable claude-code at startup
		const claudePlugin = settings.plugins["claude-code"];
		if (claudePlugin) {
			claudePlugin.enabled = false;
		}
		await saveSettings(settingsPath, settings);

		await runWithServices((services) => {
			const registry = services.getRegistry();
			// claude-code should NOT be registered since it was disabled
			const plugins = registry.getAllPlugins();
			const claudeRegistered = plugins.find((p) => p.id === "claude-code");
			expect(claudeRegistered).toBeUndefined();
		});
	});

	test("updatePluginSetting refreshes registry so subsequent reads use new state", async () => {
		await mkdir(testDir, { recursive: true });
		await saveSettings(settingsPath, getDefaultSettings());

		await runWithServices(async (services) => {
			// Disable claude-code
			await runService(
				services.updatePluginSetting({
					pluginId: "claude-code",
					enabled: false,
				}),
			);

			// Registry should now exclude claude-code
			const registry = services.getRegistry();
			const plugins = registry.getAllPlugins();
			const claudeRegistered = plugins.find((p) => p.id === "claude-code");
			expect(claudeRegistered).toBeUndefined();
		});
	});

	test("resetSettings refreshes registry and restores default plugin availability", async () => {
		await mkdir(testDir, { recursive: true });
		const settings = getDefaultSettings();
		// Disable ALL plugins in saved settings
		for (const pluginId of Object.keys(settings.plugins)) {
			const plugin = settings.plugins[pluginId];
			if (plugin) {
				plugin.enabled = false;
			}
		}
		await saveSettings(settingsPath, settings);

		await runWithServices(async (services) => {
			// Initially all plugins are disabled
			const registryBefore = services.getRegistry();
			expect(registryBefore.getAllPlugins()).toHaveLength(0);

			// Reset settings — goes back to defaults (all enabled)
			await runService(services.resetSettings());

			// After reset, plugin settings should reflect defaults (all enabled)
			const { plugins } = await runService(services.getPluginSettings());
			for (const plugin of plugins) {
				expect(plugin.enabled).toBe(true);
			}

			// The registry should be a new instance rebuilt from defaults
			const registryAfter = services.getRegistry();
			expect(registryAfter).not.toBe(registryBefore);
		});
	});

	test("updatePluginSetting with dataDir change affects subsequent registry-backed reads", async () => {
		await mkdir(testDir, { recursive: true });
		await saveSettings(settingsPath, getDefaultSettings());

		await runWithServices(async (services) => {
			const customDataDir = join(testDir, "custom-claude-data");

			// Update claude-code's dataDir to a custom path
			await runService(
				services.updatePluginSetting({
					pluginId: "claude-code",
					dataDir: customDataDir,
				}),
			);

			// The registry should have been rebuilt. Since the custom dataDir
			// does not contain valid data, claude-code should NOT be registered.
			const registry = services.getRegistry();
			const claudeRegistered = registry.getAllPlugins().find((p) => p.id === "claude-code");
			expect(claudeRegistered).toBeUndefined();

			// Verify the settings were persisted with the new dataDir
			const { plugins } = await runService(services.getPluginSettings());
			const claudeSettings = plugins.find((p) => p.id === "claude-code");
			expect(claudeSettings).toBeDefined();
			expect(claudeSettings?.dataDir).toBe(customDataDir);
		});
	});

	test("failed updatePluginSetting does not report success", async () => {
		await mkdir(testDir, { recursive: true });
		await saveSettings(settingsPath, getDefaultSettings());

		await runWithServices(async (services) => {
			// Updating an unknown plugin should throw — the error must propagate,
			// not be silently swallowed as a successful no-op
			await expect(
				runService(
					services.updatePluginSetting({
						pluginId: "nonexistent-plugin",
						enabled: false,
					}),
				),
			).rejects.toThrow("Unknown plugin: nonexistent-plugin");
		});
	});

	test("getRegistry returns current mutable registry, not stale snapshot", async () => {
		await mkdir(testDir, { recursive: true });
		await saveSettings(settingsPath, getDefaultSettings());

		await runWithServices(async (services) => {
			const registryBefore = services.getRegistry();

			// Update a plugin setting to trigger refresh
			await runService(
				services.updatePluginSetting({
					pluginId: "claude-code",
					enabled: false,
				}),
			);

			const registryAfter = services.getRegistry();

			// The registry should be a different instance after refresh
			expect(registryAfter).not.toBe(registryBefore);
		});
	});
});
