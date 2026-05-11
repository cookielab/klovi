export const noop = (): undefined => undefined;
export const T_KEYBOARD_TEST = "Keyboard test";

export function fireKey(key: string, opts: KeyboardEventInit = {}): void {
	// Dispatch directly on window since the hook listens on window
	globalThis.dispatchEvent(new KeyboardEvent("keydown", { key: key, bubbles: true, ...opts }));
}
