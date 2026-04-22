import { afterEach, describe, expect, test } from "bun:test";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import type { DashboardStats } from "../../../shared/types.ts";
import { MockProviders, setupMockRPC } from "../../test-helpers/mock-rpc.ts";
import { PackageDashboardStats } from "./PackageDashboardStats.tsx";

function makeStats(projects: number): DashboardStats {
	return {
		projects: projects,
		sessions: 2,
		messages: 3,
		todaySessions: 1,
		thisWeekSessions: 2,
		inputTokens: 10,
		outputTokens: 5,
		cacheReadTokens: 0,
		cacheCreationTokens: 0,
		toolCalls: 1,
		models: {},
	};
}

describe("PackageDashboardStats", () => {
	afterEach(() => {
		cleanup();
	});

	test("shows a scaffold on a cold load", () => {
		setupMockRPC({
			getStats: () => new Promise(() => {}),
		});

		render(<PackageDashboardStats />, { wrapper: MockProviders });

		expect(screen.getByRole("status", { name: "Loading stats" })).toBeDefined();
		expect(screen.getByText("Loading stats...")).toBeDefined();
	});

	test("uses server-cached stats before polling to a fresh result", async () => {
		let getStatsCalls = 0;

		setupMockRPC({
			getStats: () => {
				getStatsCalls += 1;
				if (getStatsCalls === 1) {
					return Promise.resolve({ stats: makeStats(4), refreshing: true, cachedAt: "2026-04-22T10:00:00.000Z" });
				}
				return Promise.resolve({ stats: makeStats(7), refreshing: false, cachedAt: "2026-04-22T10:00:01.000Z" });
			},
		});

		render(<PackageDashboardStats />, { wrapper: MockProviders });

		await waitFor(() => {
			const projectsLabel = screen.getByText("Projects");
			expect(projectsLabel.previousSibling?.textContent).toBe("4");
		});
		expect(screen.getByText("Refreshing stats...")).toBeDefined();

		await waitFor(() => {
			const projectsLabel = screen.getByText("Projects");
			expect(projectsLabel.previousSibling?.textContent).toBe("7");
		});
		expect(getStatsCalls).toBeGreaterThanOrEqual(2);
		expect(screen.queryByText("Refreshing stats...")).toBeNull();
	});

	test("updates when the desktop host pushes refreshed stats", async () => {
		let listener: ((stats: DashboardStats) => void) | null = null;

		setupMockRPC({
			getStats: () => Promise.resolve({ stats: makeStats(1), refreshing: false }),
			hostBridge: {
				onStatsUpdated: (callback) => {
					listener = callback;
					return () => {
						if (listener === callback) {
							listener = null;
						}
					};
				},
			},
		});

		render(<PackageDashboardStats />, { wrapper: MockProviders });

		await screen.findByText("Projects");
		await waitFor(() => {
			const projectsLabel = screen.getByText("Projects");
			expect(projectsLabel.previousSibling?.textContent).toBe("1");
		});

		await act(async () => {
			listener?.(makeStats(9));
			await Promise.resolve();
		});

		await waitFor(() => {
			const projectsLabel = screen.getByText("Projects");
			expect(projectsLabel.previousSibling?.textContent).toBe("9");
		});
	});
});
