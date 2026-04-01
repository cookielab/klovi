import { describe, expect, test } from "bun:test";

// happy-dom's navigator.platform is not Mac, so formatShortcut uses non-Mac branch
describe("formatShortcut", () => {
	test("formats Mod as Ctrl on non-Mac", async () => {
		const { formatShortcut } = await import("./shortcut.ts");
		expect(formatShortcut("Mod", "K")).toBe("Ctrl+K");
	});

	test("formats multiple keys with + separator on non-Mac", async () => {
		const { formatShortcut } = await import("./shortcut.ts");
		// biome-ignore lint/security/noSecrets: not a secret, just a keyboard shortcut
		expect(formatShortcut("Mod", "Shift", "P")).toBe("Ctrl+Shift+P");
	});

	test("passes through non-modifier keys unchanged", async () => {
		const { formatShortcut } = await import("./shortcut.ts");
		expect(formatShortcut("Mod", ",")).toBe("Ctrl+,");
	});
});
