import { mock, spyOn } from "bun:test";
import { GlobalWindow } from "happy-dom";
import { setupMockRpc } from "./packages/ui/src/app/test-helpers/mock-rpc";

const N_800 = 800;
const N_600 = 600;

(globalThis as Record<string, unknown>)["mock"] = mock;
(globalThis as Record<string, unknown>)["spyOn"] = spyOn;

// React 19 requires this flag so testing-library's act() integration works under
// happy-dom; without it, async updates trigger "act()" warnings and waitFor() hangs.
(globalThis as Record<string, unknown>)["IS_REACT_ACT_ENVIRONMENT"] = true;

const window = new GlobalWindow();

// Register DOM globals
const globals = [
	"document",
	"window",
	"HTMLElement",
	"HTMLDivElement",
	"HTMLSpanElement",
	"HTMLAnchorElement",
	"HTMLImageElement",
	"HTMLInputElement",
	"HTMLTextAreaElement",
	"Element",
	"Node",
	"Text",
	"DocumentFragment",
	"Event",
	"MouseEvent",
	"KeyboardEvent",
	"CustomEvent",
	"MutationObserver",
	"navigator",
	"location",
	"getComputedStyle",
	"matchMedia",
	"requestAnimationFrame",
	"cancelAnimationFrame",
	"localStorage",
	"history",
	"addEventListener",
	"removeEventListener",
	"dispatchEvent",
] as const;

for (const key of globals) {
	if (key in window) {
		(globalThis as Record<string, unknown>)[key] = (window as unknown as Record<string, unknown>)[key];
	}
}

// Set up default RPC mock for all tests
setupMockRpc();

// Shim ResizeObserver for @tanstack/react-virtual measureElement under happy-dom
if (!("ResizeObserver" in globalThis)) {
	class ResizeObserverShim {
		public observe(): void {
			// noop shim for happy-dom
		}
		public unobserve(): void {
			// noop shim for happy-dom
		}
		public disconnect(): void {
			// noop shim for happy-dom
		}
	}
	(globalThis as Record<string, unknown>)["ResizeObserver"] = ResizeObserverShim;
}

// Shim getBoundingClientRect for @tanstack/react-virtual under happy-dom.
// happy-dom returns all-zero rects, which makes useVirtualizer short-circuit
// to an empty viewport. Return a reasonable fixed viewport so virtualization
// tests can exercise the windowing path. Tests needing precise measurements
// can override per-element via Object.defineProperty.
if (typeof HTMLElement !== "undefined") {
	const originalGet = HTMLElement.prototype.getBoundingClientRect;
	HTMLElement.prototype.getBoundingClientRect = function getBoundingClientRect() {
		const rect = originalGet.call(this);
		if (rect.width !== 0 || rect.height !== 0) {
			return rect;
		}
		return {
			x: 0,
			y: 0,
			top: 0,
			left: 0,
			right: N_800,
			bottom: N_600,
			width: N_800,
			height: N_600,
			["toJSON"]: () => ({}),
		} as DOMRect;
	};
}
