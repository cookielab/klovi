import { describe, expect, test } from "bun:test";
import { browserHostBridge } from "./browser-host-bridge.ts";

describe("browserHostBridge capabilities", () => {
	const caps = browserHostBridge.getCapabilities();

	test("desktop is false", () => {
		expect(caps.desktop).toBe(false);
	});

	test("browseDirectory is false", () => {
		expect(caps.browseDirectory).toBe(false);
	});

	test("updater is false", () => {
		expect(caps.updater).toBe(false);
	});

	test("menuActions is false", () => {
		expect(caps.menuActions).toBe(false);
	});
});

describe("browserHostBridge methods in browser mode", () => {
	test("browseDirectory returns null path", async () => {
		const result = await browserHostBridge.browseDirectory({});
		expect(result.path).toBeNull();
	});

	test("applyUpdate returns not supported", async () => {
		const result = await browserHostBridge.applyUpdate();
		expect(result.ok).toBe(false);
		expect(result.error).toContain("Not supported");
	});

	test("checkForUpdate returns up-to-date", async () => {
		const result = await browserHostBridge.checkForUpdate();
		expect(result.status).toBe("up-to-date");
	});

	test("onMenuAction returns no-op unsubscribe", () => {
		const unsubscribe = browserHostBridge.onMenuAction(() => {});
		expect(typeof unsubscribe).toBe("function");
		unsubscribe(); // should not throw
	});

	test("onUpdateStatus returns no-op unsubscribe", () => {
		const unsubscribe = browserHostBridge.onUpdateStatus(() => {});
		expect(typeof unsubscribe).toBe("function");
		unsubscribe();
	});

	test("connection state is always connected", () => {
		expect(browserHostBridge.getConnectionState()).toBe("connected");
		const unsubscribe = browserHostBridge.onConnectionState(() => {});
		expect(typeof unsubscribe).toBe("function");
		unsubscribe();
	});
});
