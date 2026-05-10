import { browserHostBridge } from "./browser-host-bridge";

describe("browserHostBridge capabilities", () => {
	const caps = browserHostBridge.getCapabilities();

	it("desktop is false", () => {
		expect(caps.desktop).toBe(false);
	});

	it("browseDirectory is false", () => {
		expect(caps.browseDirectory).toBe(false);
	});

	it("updater is false", () => {
		expect(caps.updater).toBe(false);
	});

	it("menuActions is false", () => {
		expect(caps.menuActions).toBe(false);
	});
});

describe("browserHostBridge methods in browser mode", () => {
	it("browseDirectory returns null path", async () => {
		const result = await browserHostBridge.browseDirectory({});
		expect(result.path).toBeNull();
	});

	it("applyUpdate returns not supported", async () => {
		const result = await browserHostBridge.applyUpdate();
		expect(result.ok).toBe(false);
		expect(result.error).toContain("Not supported");
	});

	it("checkForUpdate returns up-to-date", async () => {
		const result = await browserHostBridge.checkForUpdate();
		expect(result.status).toBe("up-to-date");
	});

	it("onMenuAction returns no-op unsubscribe", () => {
		const unsubscribe = browserHostBridge.onMenuAction(() => undefined);
		expect(typeof unsubscribe).toBe("function");
		unsubscribe(); // should not throw
	});

	it("onUpdateStatus returns no-op unsubscribe", () => {
		const unsubscribe = browserHostBridge.onUpdateStatus(() => undefined);
		expect(typeof unsubscribe).toBe("function");
		unsubscribe();
	});

	it("onStatsUpdated returns no-op unsubscribe", () => {
		const unsubscribe = browserHostBridge.onStatsUpdated(() => undefined);
		expect(typeof unsubscribe).toBe("function");
		unsubscribe();
	});

	it("connection state is always connected", () => {
		expect(browserHostBridge.getConnectionState()).toBe("connected");
		const unsubscribe = browserHostBridge.onConnectionState(() => undefined);
		expect(typeof unsubscribe).toBe("function");
		unsubscribe();
	});
});
