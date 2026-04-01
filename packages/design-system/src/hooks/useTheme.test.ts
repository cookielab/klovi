import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { act, cleanup, renderHook } from "@testing-library/react";
import { useFontSize } from "./useFontSize.ts";
import { resolveTheme, useTheme } from "./useTheme.ts";

const THEME_KEY = "klovi-theme";
const FONT_SIZE_KEY = "klovi-font-size";
const originalMatchMedia = window.matchMedia;

type MockMediaApi = {
	addEventListener: ReturnType<typeof mock>;
	removeEventListener: ReturnType<typeof mock>;
	dispatch: (matches: boolean) => void;
};

function installMatchMedia(initialMatches: boolean): MockMediaApi {
	const listeners = new Set<(event: Event) => void>();
	let matches = initialMatches;

	const mediaQuery = {
		media: "(prefers-color-scheme: dark)",
		get matches() {
			return matches;
		},
		onchange: null,
		addEventListener: mock((_event: string, callback: EventListenerOrEventListenerObject) => {
			if (typeof callback === "function") {
				listeners.add(callback as (event: Event) => void);
			} else {
				listeners.add((event: Event) => callback.handleEvent(event));
			}
		}),
		removeEventListener: mock((_event: string, callback: EventListenerOrEventListenerObject) => {
			if (typeof callback === "function") {
				listeners.delete(callback as (event: Event) => void);
			} else {
				for (const handler of listeners) {
					if (handler.toString() === callback.handleEvent.toString()) {
						listeners.delete(handler);
					}
				}
			}
		}),
	};

	Object.defineProperty(window, "matchMedia", {
		configurable: true,
		value: () => mediaQuery,
	});

	return {
		addEventListener: mediaQuery.addEventListener,
		removeEventListener: mediaQuery.removeEventListener,
		dispatch: (nextMatches: boolean) => {
			matches = nextMatches;
			for (const listener of listeners) {
				listener(new Event("change"));
			}
		},
	};
}

beforeEach(() => {
	localStorage.removeItem(THEME_KEY);
	localStorage.removeItem(FONT_SIZE_KEY);
	document.documentElement.removeAttribute("data-theme");
	document.documentElement.style.removeProperty("--font-size-base");
});

afterEach(() => {
	cleanup();
	localStorage.removeItem(THEME_KEY);
	localStorage.removeItem(FONT_SIZE_KEY);
	document.documentElement.removeAttribute("data-theme");
	document.documentElement.style.removeProperty("--font-size-base");
	Object.defineProperty(window, "matchMedia", {
		configurable: true,
		value: originalMatchMedia,
	});
});

describe("resolveTheme", () => {
	test("returns explicit non-system values", () => {
		expect(resolveTheme("light")).toBe("light");
		expect(resolveTheme("dark")).toBe("dark");
	});

	test("uses override when setting is system", () => {
		expect(resolveTheme("system", "dark")).toBe("dark");
		expect(resolveTheme("system", "light")).toBe("light");
	});

	test("ignores override for explicit settings", () => {
		expect(resolveTheme("light", "dark")).toBe("light");
		expect(resolveTheme("dark", "light")).toBe("dark");
	});
});

describe("useTheme", () => {
	test("defaults to system and resolves from matchMedia", () => {
		installMatchMedia(true);

		const { result } = renderHook(() => useTheme());

		expect(result.current.setting).toBe("system");
		expect(result.current.resolved).toBe("dark");
		expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
		expect(localStorage.getItem(THEME_KEY)).toBe("system");
	});

	test("restores stored theme and cycles settings", () => {
		installMatchMedia(false);
		localStorage.setItem(THEME_KEY, "light");

		const { result } = renderHook(() => useTheme());

		expect(result.current.setting).toBe("light");
		expect(result.current.resolved).toBe("light");

		act(() => result.current.cycle());
		expect(result.current.setting).toBe("dark");
		expect(localStorage.getItem(THEME_KEY)).toBe("dark");

		act(() => result.current.cycle());
		expect(result.current.setting).toBe("system");

		act(() => result.current.cycle());
		expect(result.current.setting).toBe("light");
	});

	test("reacts to system theme changes in system mode", () => {
		const media = installMatchMedia(false);

		const { result, unmount } = renderHook(() => useTheme());

		expect(media.addEventListener).toHaveBeenCalledTimes(1);
		expect(result.current.resolved).toBe("light");

		act(() => media.dispatch(true));
		expect(result.current.resolved).toBe("dark");

		unmount();
		expect(media.removeEventListener).toHaveBeenCalledTimes(1);
	});

	test("does not subscribe to system changes when theme is explicit", () => {
		const media = installMatchMedia(false);
		localStorage.setItem(THEME_KEY, "dark");

		renderHook(() => useTheme());

		expect(media.addEventListener).toHaveBeenCalledTimes(0);
	});

	test("set() updates explicit setting", () => {
		installMatchMedia(false);

		const { result } = renderHook(() => useTheme());

		act(() => result.current.set("dark"));

		expect(result.current.setting).toBe("dark");
		expect(result.current.resolved).toBe("dark");
		expect(localStorage.getItem(THEME_KEY)).toBe("dark");
	});

	test("uses systemThemeOverride when set and setting is system", () => {
		installMatchMedia(false);

		const { result } = renderHook(() => useTheme({ systemThemeOverride: "dark" }));

		expect(result.current.setting).toBe("system");
		expect(result.current.resolved).toBe("dark");
	});

	test("ignores systemThemeOverride when setting is explicit", () => {
		installMatchMedia(false);
		localStorage.setItem(THEME_KEY, "light");

		const { result } = renderHook(() => useTheme({ systemThemeOverride: "dark" }));

		expect(result.current.setting).toBe("light");
		expect(result.current.resolved).toBe("light");
	});

	test("does not subscribe to matchMedia when systemThemeOverride is active", () => {
		const media = installMatchMedia(false);

		renderHook(() => useTheme({ systemThemeOverride: "dark" }));

		expect(media.addEventListener).toHaveBeenCalledTimes(0);
	});

	test("reacts to systemThemeOverride changes", () => {
		installMatchMedia(false);

		const { result, rerender } = renderHook(
			({ override }: { override: "dark" | "light" | null }) => useTheme({ systemThemeOverride: override }),
			{ initialProps: { override: "dark" as "dark" | "light" | null } },
		);

		expect(result.current.resolved).toBe("dark");

		rerender({ override: "light" });
		expect(result.current.resolved).toBe("light");
	});
});

describe("useFontSize", () => {
	test("defaults to 15 and writes css var + storage", () => {
		const { result } = renderHook(() => useFontSize());

		expect(result.current.size).toBe(15);
		expect(document.documentElement.style.getPropertyValue("--font-size-base")).toBe("15px");
		expect(localStorage.getItem(FONT_SIZE_KEY)).toBe("15");
	});

	test("restores from localStorage and clamps bounds", () => {
		localStorage.setItem(FONT_SIZE_KEY, "28");
		const { result } = renderHook(() => useFontSize());

		expect(result.current.size).toBe(28);

		act(() => result.current.increase());
		expect(result.current.size).toBe(28);

		act(() => result.current.decrease());
		expect(result.current.size).toBe(26);

		act(() => result.current.set(5));
		expect(result.current.size).toBe(10);

		act(() => result.current.set(50));
		expect(result.current.size).toBe(28);
	});
});
