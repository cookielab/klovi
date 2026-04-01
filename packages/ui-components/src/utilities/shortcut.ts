const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad|iPod/u.test(navigator.platform);

const MAC_KEY_MAP: Record<string, string> = {
	Mod: "⌘",
	Alt: "⌥",
	Shift: "⇧",
	Ctrl: "⌃",
};

export function formatShortcut(...keys: string[]): string {
	if (isMac) {
		return keys.map((k) => MAC_KEY_MAP[k] ?? k).join("");
	}
	return keys.map((k) => (k === "Mod" ? "Ctrl" : k)).join("+");
}
