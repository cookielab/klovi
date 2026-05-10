import type { FileSystem } from "@effect/platform";
import { Effect } from "effect";
import type { SettingsWriteError } from "./errors";
import { deleteSettingsFile, getDefaultSettings, saveSettings, settingsFileExists } from "./settings";

function isFirstLaunch(settingsPath: string): Effect.Effect<{ firstLaunch: boolean }, never, FileSystem.FileSystem> {
	return Effect.gen(function* () {
		const exists = yield* settingsFileExists(settingsPath);
		return { firstLaunch: !exists };
	});
}

function completeOnboarding(
	settingsPath: string,
): Effect.Effect<{ ok: boolean }, SettingsWriteError, FileSystem.FileSystem> {
	return Effect.gen(function* () {
		const { firstLaunch } = yield* isFirstLaunch(settingsPath);
		if (firstLaunch) {
			yield* saveSettings(settingsPath, getDefaultSettings());
		}
		return { ok: true };
	});
}

function resetSettings(settingsPath: string): Effect.Effect<{ ok: boolean }, never, FileSystem.FileSystem> {
	return Effect.gen(function* () {
		yield* deleteSettingsFile(settingsPath);
		return { ok: true };
	});
}

export { completeOnboarding, isFirstLaunch, resetSettings };
