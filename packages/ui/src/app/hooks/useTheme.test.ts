import { act, renderHook } from "@testing-library/react";
import { useFontSize, usePresentationFontSize, usePresentationTheme, useTheme } from "./useTheme";

const THEME_KEY = "klovi-theme";
const FONT_SIZE_KEY = "klovi-font-size";
const PRES_THEME_KEY = "klovi-presentation-theme";
const PRES_SAME_THEME_KEY = "klovi-presentation-same-theme";
const PRES_FONT_SIZE_KEY = "klovi-presentation-font-size";
const PRES_SAME_FONT_SIZE_KEY = "klovi-presentation-same-font-size";

beforeEach(() => {
	localStorage.removeItem(THEME_KEY);
	localStorage.removeItem(FONT_SIZE_KEY);
	localStorage.removeItem(PRES_THEME_KEY);
	localStorage.removeItem(PRES_SAME_THEME_KEY);
	localStorage.removeItem(PRES_FONT_SIZE_KEY);
	localStorage.removeItem(PRES_SAME_FONT_SIZE_KEY);
});

afterEach(() => {
	localStorage.removeItem(THEME_KEY);
	localStorage.removeItem(FONT_SIZE_KEY);
	localStorage.removeItem(PRES_THEME_KEY);
	localStorage.removeItem(PRES_SAME_THEME_KEY);
	localStorage.removeItem(PRES_FONT_SIZE_KEY);
	localStorage.removeItem(PRES_SAME_FONT_SIZE_KEY);
	document.documentElement.removeAttribute("data-theme");
	document.documentElement.style.removeProperty("--font-size-base");
});

describe("useTheme", () => {
	it("defaults to system setting", () => {
		const { result } = renderHook(() => useTheme());
		expect(result.current.setting).toBe("system");
	});

	it("restores light from localStorage", () => {
		localStorage.setItem(THEME_KEY, "light");
		const { result } = renderHook(() => useTheme());
		expect(result.current.setting).toBe("light");
		expect(result.current.resolved).toBe("light");
	});

	it("restores dark from localStorage", () => {
		localStorage.setItem(THEME_KEY, "dark");
		const { result } = renderHook(() => useTheme());
		expect(result.current.setting).toBe("dark");
		expect(result.current.resolved).toBe("dark");
	});

	it("treats invalid stored value as system", () => {
		localStorage.setItem(THEME_KEY, "invalid-value");
		const { result } = renderHook(() => useTheme());
		expect(result.current.setting).toBe("system");
	});

	it("cycle goes system -> light -> dark -> system", () => {
		const { result } = renderHook(() => useTheme());
		expect(result.current.setting).toBe("system");

		act(() => result.current.cycle());
		expect(result.current.setting).toBe("light");

		act(() => result.current.cycle());
		expect(result.current.setting).toBe("dark");

		act(() => result.current.cycle());
		expect(result.current.setting).toBe("system");
	});

	it("sets data-theme attribute on document", () => {
		localStorage.setItem(THEME_KEY, "dark");
		renderHook(() => useTheme());
		expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
	});

	it("persists setting to localStorage on cycle", () => {
		const { result } = renderHook(() => useTheme());
		act(() => result.current.cycle());
		expect(localStorage.getItem(THEME_KEY)).toBe("light");
	});

	it("set() updates theme directly", () => {
		const { result } = renderHook(() => useTheme());
		act(() => result.current.set("dark"));
		expect(result.current.setting).toBe("dark");
		expect(localStorage.getItem(THEME_KEY)).toBe("dark");
	});

	it("set() to system works", () => {
		localStorage.setItem(THEME_KEY, "dark");
		const { result } = renderHook(() => useTheme());
		act(() => result.current.set("system"));
		expect(result.current.setting).toBe("system");
		expect(localStorage.getItem(THEME_KEY)).toBe("system");
	});
});

describe("useFontSize", () => {
	it("defaults to 15", () => {
		const { result } = renderHook(() => useFontSize());
		expect(result.current.size).toBe(15);
	});

	it("restores from localStorage", () => {
		localStorage.setItem(FONT_SIZE_KEY, "20");
		const { result } = renderHook(() => useFontSize());
		expect(result.current.size).toBe(20);
	});

	it("increase adds 2", () => {
		const { result } = renderHook(() => useFontSize());
		act(() => result.current.increase());
		expect(result.current.size).toBe(17);
	});

	it("decrease subtracts 2", () => {
		const { result } = renderHook(() => useFontSize());
		act(() => result.current.decrease());
		expect(result.current.size).toBe(13);
	});

	it("does not exceed max of 28", () => {
		localStorage.setItem(FONT_SIZE_KEY, "28");
		const { result } = renderHook(() => useFontSize());
		act(() => result.current.increase());
		expect(result.current.size).toBe(28);
	});

	it("does not go below min of 10", () => {
		localStorage.setItem(FONT_SIZE_KEY, "10");
		const { result } = renderHook(() => useFontSize());
		act(() => result.current.decrease());
		expect(result.current.size).toBe(10);
	});

	it("sets CSS custom property", () => {
		renderHook(() => useFontSize());
		expect(document.documentElement.style.getPropertyValue("--font-size-base")).toBe("15px");
	});

	it("persists to localStorage", () => {
		const { result } = renderHook(() => useFontSize());
		act(() => result.current.increase());
		expect(localStorage.getItem(FONT_SIZE_KEY)).toBe("17");
	});

	it("set() updates size directly", () => {
		const { result } = renderHook(() => useFontSize());
		act(() => result.current.set(22));
		expect(result.current.size).toBe(22);
		expect(localStorage.getItem(FONT_SIZE_KEY)).toBe("22");
	});

	it("set() clamps to min 10", () => {
		const { result } = renderHook(() => useFontSize());
		act(() => result.current.set(5));
		expect(result.current.size).toBe(10);
	});

	it("set() clamps to max 28", () => {
		const { result } = renderHook(() => useFontSize());
		act(() => result.current.set(50));
		expect(result.current.size).toBe(28);
	});
});

describe("usePresentationTheme", () => {
	it("defaults to system setting", () => {
		const { result } = renderHook(() => usePresentationTheme());
		expect(result.current.setting).toBe("system");
	});

	it("defaults sameAsGlobal to true", () => {
		const { result } = renderHook(() => usePresentationTheme());
		expect(result.current.sameAsGlobal).toBe(true);
	});

	it("restores setting from localStorage", () => {
		localStorage.setItem(PRES_THEME_KEY, "dark");
		const { result } = renderHook(() => usePresentationTheme());
		expect(result.current.setting).toBe("dark");
	});

	it("restores sameAsGlobal false from localStorage", () => {
		localStorage.setItem(PRES_SAME_THEME_KEY, "false");
		const { result } = renderHook(() => usePresentationTheme());
		expect(result.current.sameAsGlobal).toBe(false);
	});

	it("set() updates theme and persists", () => {
		const { result } = renderHook(() => usePresentationTheme());
		act(() => result.current.set("light"));
		expect(result.current.setting).toBe("light");
		expect(localStorage.getItem(PRES_THEME_KEY)).toBe("light");
	});

	it("cycle goes system -> light -> dark -> system", () => {
		const { result } = renderHook(() => usePresentationTheme());
		expect(result.current.setting).toBe("system");

		act(() => result.current.cycle());
		expect(result.current.setting).toBe("light");

		act(() => result.current.cycle());
		expect(result.current.setting).toBe("dark");

		act(() => result.current.cycle());
		expect(result.current.setting).toBe("system");
	});

	it("setSameAsGlobal persists to localStorage", () => {
		const { result } = renderHook(() => usePresentationTheme());
		act(() => result.current.setSameAsGlobal(false));
		expect(result.current.sameAsGlobal).toBe(false);
		expect(localStorage.getItem(PRES_SAME_THEME_KEY)).toBe("false");
	});

	it("does NOT set data-theme on document", () => {
		document.documentElement.removeAttribute("data-theme");
		renderHook(() => usePresentationTheme());
		expect(document.documentElement.getAttribute("data-theme")).toBeNull();
	});

	it("treats invalid stored value as system", () => {
		localStorage.setItem(PRES_THEME_KEY, "invalid");
		const { result } = renderHook(() => usePresentationTheme());
		expect(result.current.setting).toBe("system");
	});
});

describe("usePresentationFontSize", () => {
	it("defaults to 15", () => {
		const { result } = renderHook(() => usePresentationFontSize());
		expect(result.current.size).toBe(15);
	});

	it("defaults sameAsGlobal to true", () => {
		const { result } = renderHook(() => usePresentationFontSize());
		expect(result.current.sameAsGlobal).toBe(true);
	});

	it("restores size from localStorage", () => {
		localStorage.setItem(PRES_FONT_SIZE_KEY, "22");
		const { result } = renderHook(() => usePresentationFontSize());
		expect(result.current.size).toBe(22);
	});

	it("restores sameAsGlobal false from localStorage", () => {
		localStorage.setItem(PRES_SAME_FONT_SIZE_KEY, "false");
		const { result } = renderHook(() => usePresentationFontSize());
		expect(result.current.sameAsGlobal).toBe(false);
	});

	it("increase adds 2", () => {
		const { result } = renderHook(() => usePresentationFontSize());
		act(() => result.current.increase());
		expect(result.current.size).toBe(17);
	});

	it("decrease subtracts 2", () => {
		const { result } = renderHook(() => usePresentationFontSize());
		act(() => result.current.decrease());
		expect(result.current.size).toBe(13);
	});

	it("does not exceed max of 28", () => {
		localStorage.setItem(PRES_FONT_SIZE_KEY, "28");
		const { result } = renderHook(() => usePresentationFontSize());
		act(() => result.current.increase());
		expect(result.current.size).toBe(28);
	});

	it("does not go below min of 10", () => {
		localStorage.setItem(PRES_FONT_SIZE_KEY, "10");
		const { result } = renderHook(() => usePresentationFontSize());
		act(() => result.current.decrease());
		expect(result.current.size).toBe(10);
	});

	it("set() updates size and persists", () => {
		const { result } = renderHook(() => usePresentationFontSize());
		act(() => result.current.set(20));
		expect(result.current.size).toBe(20);
		expect(localStorage.getItem(PRES_FONT_SIZE_KEY)).toBe("20");
	});

	it("set() clamps to bounds", () => {
		const { result } = renderHook(() => usePresentationFontSize());
		act(() => result.current.set(5));
		expect(result.current.size).toBe(10);
		act(() => result.current.set(50));
		expect(result.current.size).toBe(28);
	});

	it("setSameAsGlobal persists to localStorage", () => {
		const { result } = renderHook(() => usePresentationFontSize());
		act(() => result.current.setSameAsGlobal(false));
		expect(result.current.sameAsGlobal).toBe(false);
		expect(localStorage.getItem(PRES_SAME_FONT_SIZE_KEY)).toBe("false");
	});

	it("does NOT set --font-size-base CSS property", () => {
		document.documentElement.style.removeProperty("--font-size-base");
		renderHook(() => usePresentationFontSize());
		expect(document.documentElement.style.getPropertyValue("--font-size-base")).toBe("");
	});
});
