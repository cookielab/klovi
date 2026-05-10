// happy-dom's navigator.platform is not Mac, so formatShortcut uses non-Mac branch
describe("formatShortcut", () => {
	it("formats Mod as Ctrl on non-Mac", async () => {
		const { formatShortcut } = await import("./shortcut");
		expect(formatShortcut("Mod", "K")).toBe("Ctrl+K");
	});

	it("formats multiple keys with + separator on non-Mac", async () => {
		const { formatShortcut } = await import("./shortcut");
		expect(formatShortcut("Mod", "Shift", "P")).toBe("Ctrl+Shift+P");
	});

	it("passes through non-modifier keys unchanged", async () => {
		const { formatShortcut } = await import("./shortcut");
		expect(formatShortcut("Mod", ",")).toBe("Ctrl+,");
	});
});
