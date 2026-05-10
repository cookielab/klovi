import { mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BunContext } from "@effect/platform-bun";
import { Effect } from "effect";
import { getUpdateSettings, updateUpdateSettings } from "./settings-service";
import { getVersion, makeVersionState } from "./version-service";


const N_6 = 6;
const N_100 = 100;
const N_24 = 24;
const N_3_7 = 3.7;
const N_4 = 4;

function runFs<A, E>(effect: Effect.Effect<A, E, import("@effect/platform").FileSystem.FileSystem>): Promise<A> {
	return Effect.runPromise(effect.pipe(Effect.provide(BunContext.layer)));
}

describe("version-service", () => {
	it("getVersion returns info from state", () => {
		const state = makeVersionState("1.2.3", "abc");
		const result = getVersion(state);
		expect(result.version).toBe("1.2.3");
		expect(result.commit).toBe("abc");
	});

	it("makeVersionState normalizes 0.0.0 to dev", () => {
		const state = makeVersionState("0.0.0", "");
		expect(state.version).toBe("dev");
	});
});

const testDir = join(tmpdir(), `klovi-rpc-test-${Date.now()}`);

describe("update settings handlers", () => {
	afterEach(async () => {
		try {
			await rm(testDir, { recursive: true });
		} catch {}
	});

	it("getUpdateSettings returns defaults when no settings exist", async () => {
		const path = join(testDir, "nonexistent", "settings.json");
		const result = await runFs(getUpdateSettings(path));
		expect(result.channel).toBe("stable");
		expect(result.checkIntervalHours).toBe(N_6);
		expect(result.autoDownload).toBe(true);
	});

	it("updateUpdateSettings persists channel change", async () => {
		await mkdir(testDir, { recursive: true });
		const path = join(testDir, "settings.json");
		const result = await runFs(updateUpdateSettings(path, { channel: "beta" }));
		expect(result.channel).toBe("beta");
		const reloaded = await runFs(getUpdateSettings(path));
		expect(reloaded.channel).toBe("beta");
	});

	it("updateUpdateSettings persists checkIntervalHours change", async () => {
		await mkdir(testDir, { recursive: true });
		const path = join(testDir, "settings.json");
		const result = await runFs(updateUpdateSettings(path, { checkIntervalHours: 1 }));
		expect(result.checkIntervalHours).toBe(1);
	});

	it("updateUpdateSettings persists autoDownload change", async () => {
		await mkdir(testDir, { recursive: true });
		const path = join(testDir, "settings.json");
		const result = await runFs(updateUpdateSettings(path, { autoDownload: false }));
		expect(result.autoDownload).toBe(false);
	});

	it("updateUpdateSettings clamps checkIntervalHours to 1-24", async () => {
		await mkdir(testDir, { recursive: true });
		const path = join(testDir, "settings.json");
		expect((await runFs(updateUpdateSettings(path, { checkIntervalHours: 0 }))).checkIntervalHours).toBe(1);
		expect((await runFs(updateUpdateSettings(path, { checkIntervalHours: N_100 }))).checkIntervalHours).toBe(N_24);
		expect((await runFs(updateUpdateSettings(path, { checkIntervalHours: N_3_7 }))).checkIntervalHours).toBe(N_4);
	});
});
