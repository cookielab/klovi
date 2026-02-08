import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act, renderHook } from "@testing-library/react";
import { useFontSize, useTheme } from "./useTheme.ts";

const THEME_KEY = "klovi-theme";
const FONT_SIZE_KEY = "klovi-font-size";

beforeEach(() => {
  localStorage.removeItem(THEME_KEY);
  localStorage.removeItem(FONT_SIZE_KEY);
});

afterEach(() => {
  localStorage.removeItem(THEME_KEY);
  localStorage.removeItem(FONT_SIZE_KEY);
  document.documentElement.removeAttribute("data-theme");
  document.documentElement.style.removeProperty("--font-size-base");
});

describe("useTheme", () => {
  test("defaults to system setting", () => {
    const { result } = renderHook(() => useTheme());
    expect(result.current.setting).toBe("system");
  });

  test("restores light from localStorage", () => {
    localStorage.setItem(THEME_KEY, "light");
    const { result } = renderHook(() => useTheme());
    expect(result.current.setting).toBe("light");
    expect(result.current.resolved).toBe("light");
  });

  test("restores dark from localStorage", () => {
    localStorage.setItem(THEME_KEY, "dark");
    const { result } = renderHook(() => useTheme());
    expect(result.current.setting).toBe("dark");
    expect(result.current.resolved).toBe("dark");
  });

  test("treats invalid stored value as system", () => {
    localStorage.setItem(THEME_KEY, "invalid-value");
    const { result } = renderHook(() => useTheme());
    expect(result.current.setting).toBe("system");
  });

  test("cycle goes system -> light -> dark -> system", () => {
    const { result } = renderHook(() => useTheme());
    expect(result.current.setting).toBe("system");

    act(() => result.current.cycle());
    expect(result.current.setting).toBe("light");

    act(() => result.current.cycle());
    expect(result.current.setting).toBe("dark");

    act(() => result.current.cycle());
    expect(result.current.setting).toBe("system");
  });

  test("sets data-theme attribute on document", () => {
    localStorage.setItem(THEME_KEY, "dark");
    renderHook(() => useTheme());
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });

  test("persists setting to localStorage on cycle", () => {
    const { result } = renderHook(() => useTheme());
    act(() => result.current.cycle());
    expect(localStorage.getItem(THEME_KEY)).toBe("light");
  });
});

describe("useFontSize", () => {
  test("defaults to 15", () => {
    const { result } = renderHook(() => useFontSize());
    expect(result.current.size).toBe(15);
  });

  test("restores from localStorage", () => {
    localStorage.setItem(FONT_SIZE_KEY, "20");
    const { result } = renderHook(() => useFontSize());
    expect(result.current.size).toBe(20);
  });

  test("increase adds 2", () => {
    const { result } = renderHook(() => useFontSize());
    act(() => result.current.increase());
    expect(result.current.size).toBe(17);
  });

  test("decrease subtracts 2", () => {
    const { result } = renderHook(() => useFontSize());
    act(() => result.current.decrease());
    expect(result.current.size).toBe(13);
  });

  test("does not exceed max of 28", () => {
    localStorage.setItem(FONT_SIZE_KEY, "28");
    const { result } = renderHook(() => useFontSize());
    act(() => result.current.increase());
    expect(result.current.size).toBe(28);
  });

  test("does not go below min of 10", () => {
    localStorage.setItem(FONT_SIZE_KEY, "10");
    const { result } = renderHook(() => useFontSize());
    act(() => result.current.decrease());
    expect(result.current.size).toBe(10);
  });

  test("sets CSS custom property", () => {
    renderHook(() => useFontSize());
    expect(document.documentElement.style.getPropertyValue("--font-size-base")).toBe("15px");
  });

  test("persists to localStorage", () => {
    const { result } = renderHook(() => useFontSize());
    act(() => result.current.increase());
    expect(localStorage.getItem(FONT_SIZE_KEY)).toBe("17");
  });
});
