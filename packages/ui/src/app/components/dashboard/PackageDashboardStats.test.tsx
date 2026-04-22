import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import type { DashboardStats } from "../../../shared/types.ts";
import { MockProviders, setupMockRPC } from "../../test-helpers/mock-rpc.ts";
import { PackageDashboardStats } from "./PackageDashboardStats.tsx";

const STATS_CACHE_KEY = "klovi-dashboard-stats";

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
	beforeEach(() => {
		localStorage.removeItem(STATS_CACHE_KEY);
	});

	afterEach(() => {
		cleanup();
		localStorage.removeItem(STATS_CACHE_KEY);
	});

	test("shows a scaffold on a cold load", () => {
		setupMockRPC({
			getStats: () => new Promise(() => {}),
		});

		render(<PackageDashboardStats />, { wrapper: MockProviders });

		expect(screen.getByRole("status", { name: "Loading stats" })).toBeDefined();
		expect(screen.getByText("Loading stats...")).toBeDefined();
	});

	test("hydrates from cached stats before the fresh request resolves", async () => {
		let resolveStats: ((value: { stats: DashboardStats }) => void) | null = null;
		localStorage.setItem(
			STATS_CACHE_KEY,
			JSON.stringify({
				version: 1,
				stats: makeStats(4),
			}),
		);

		setupMockRPC({
			getStats: () =>
				new Promise((resolve) => {
					resolveStats = resolve;
				}),
		});

		render(<PackageDashboardStats />, { wrapper: MockProviders });

		await waitFor(() => {
			const projectsLabel = screen.getByText("Projects");
			expect(projectsLabel.previousSibling?.textContent).toBe("4");
		});
		expect(screen.getByText("Refreshing stats...")).toBeDefined();

		await act(async () => {
			resolveStats?.({ stats: makeStats(7) });
			await Promise.resolve();
		});

		await waitFor(() => {
			const projectsLabel = screen.getByText("Projects");
			expect(projectsLabel.previousSibling?.textContent).toBe("7");
		});
		expect(screen.queryByText("Refreshing stats...")).toBeNull();
	});

	test("updates when the desktop host pushes refreshed stats", async () => {
		let listener: ((stats: DashboardStats) => void) | null = null;

		setupMockRPC({
			getStats: () => Promise.resolve({ stats: makeStats(1) }),
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
