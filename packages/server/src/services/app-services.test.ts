import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getUpdateSettings, getVersion, updateUpdateSettings } from "./app-services.ts";

describe("rpc-handlers", () => {
	test("getVersion returns version info", () => {
		const result = getVersion();
		expect(result).toHaveProperty("version");
		expect(typeof result.version).toBe("string");
		expect(result).toHaveProperty("commit");
		expect(typeof result.commit).toBe("string");
	});
});

const testDir = join(tmpdir(), `klovi-rpc-test-${Date.now()}`);

describe("update settings handlers", () => {
	afterEach(async () => {
		try {
			await rm(testDir, { recursive: true });
		} catch {}
	});

	test("getUpdateSettings returns defaults when no settings exist", async () => {
		const path = join(testDir, "nonexistent", "settings.json");
		const result = await getUpdateSettings(path);
		expect(result.channel).toBe("stable");
		expect(result.checkIntervalHours).toBe(6);
		expect(result.autoDownload).toBe(true);
	});

	test("updateUpdateSettings persists channel change", async () => {
		await mkdir(testDir, { recursive: true });
		const path = join(testDir, "settings.json");
		const result = await updateUpdateSettings(path, { channel: "beta" });
		expect(result.channel).toBe("beta");
		const reloaded = await getUpdateSettings(path);
		expect(reloaded.channel).toBe("beta");
	});

	test("updateUpdateSettings persists checkIntervalHours change", async () => {
		await mkdir(testDir, { recursive: true });
		const path = join(testDir, "settings.json");
		const result = await updateUpdateSettings(path, { checkIntervalHours: 1 });
		expect(result.checkIntervalHours).toBe(1);
	});

	test("updateUpdateSettings persists autoDownload change", async () => {
		await mkdir(testDir, { recursive: true });
		const path = join(testDir, "settings.json");
		const result = await updateUpdateSettings(path, { autoDownload: false });
		expect(result.autoDownload).toBe(false);
	});

	test("updateUpdateSettings clamps checkIntervalHours to 1-24", async () => {
		await mkdir(testDir, { recursive: true });
		const path = join(testDir, "settings.json");
		expect((await updateUpdateSettings(path, { checkIntervalHours: 0 })).checkIntervalHours).toBe(1);
		expect((await updateUpdateSettings(path, { checkIntervalHours: 100 })).checkIntervalHours).toBe(24);
		expect((await updateUpdateSettings(path, { checkIntervalHours: 3.7 })).checkIntervalHours).toBe(4);
	});
});
