export const noop = (): undefined => undefined;
export const T_KEYBOARD_HARNESS = "keyboard harness";

export function fireKey(key: string, opts: KeyboardEventInit = {}): void {
	globalThis.dispatchEvent(new KeyboardEvent("keydown", { key: key, bubbles: true, ...opts }));
}
