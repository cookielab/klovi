import { act, renderHook } from "@testing-library/react";
import { useHiddenProjects } from "./useHiddenProjects";

const STORAGE_KEY = "klovi-hidden-projects";

beforeEach(() => {
	localStorage.removeItem(STORAGE_KEY);
});

afterEach(() => {
	localStorage.removeItem(STORAGE_KEY);
});

describe("useHiddenProjects", () => {
	it("starts with empty set", () => {
		const { result } = renderHook(() => useHiddenProjects());
		expect(result.current.hiddenIds.size).toBe(0);
	});

	it("hide adds an id", () => {
		const { result } = renderHook(() => useHiddenProjects());
		act(() => result.current.hide("project-a"));
		expect(result.current.hiddenIds.has("project-a")).toBe(true);
		expect(result.current.isHidden("project-a")).toBe(true);
	});

	it("unhide removes an id", () => {
		const { result } = renderHook(() => useHiddenProjects());
		act(() => result.current.hide("project-a"));
		act(() => result.current.unhide("project-a"));
		expect(result.current.hiddenIds.has("project-a")).toBe(false);
		expect(result.current.isHidden("project-a")).toBe(false);
	});

	it("persists to localStorage with version", () => {
		const { result } = renderHook(() => useHiddenProjects());
		act(() => result.current.hide("project-a"));
		const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
		expect(stored).toEqual({ version: 1, hiddenIds: ["project-a"] });
	});

	it("restores from localStorage", () => {
		localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, hiddenIds: ["x", "y"] }));
		const { result } = renderHook(() => useHiddenProjects());
		expect(result.current.hiddenIds.size).toBe(2);
		expect(result.current.isHidden("x")).toBe(true);
		expect(result.current.isHidden("y")).toBe(true);
	});

	it("handles corrupted data gracefully", () => {
		localStorage.setItem(STORAGE_KEY, "not-json!!!");
		const { result } = renderHook(() => useHiddenProjects());
		expect(result.current.hiddenIds.size).toBe(0);
	});

	it("handles unknown version gracefully", () => {
		localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 99, hiddenIds: ["a"] }));
		const { result } = renderHook(() => useHiddenProjects());
		expect(result.current.hiddenIds.size).toBe(0);
	});
});
