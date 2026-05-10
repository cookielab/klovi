import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import type { DashboardStats } from "../../../shared/types";
import { MockProviders, setupMockRPC } from "../../test-helpers/mock-rpc";
import { PackageDashboardStats } from "./PackageDashboardStats";



const noop = (): undefined => undefined;
const N_3 = 3;
const N_10 = 10;
const N_5 = 5;
const N_4 = 4;
const N_7 = 7;
const N_2500 = 2500;
const N_9 = 9;

function makeStats(projects: number): DashboardStats {
	return {
		projects: projects,
		sessions: 2,
		messages: N_3,
		todaySessions: 1,
		thisWeekSessions: 2,
		inputTokens: N_10,
		outputTokens: N_5,
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

	it("shows a scaffold on a cold load", () => {
		setupMockRPC({
			getStats: () => new Promise(noop),
		});

		render(<PackageDashboardStats />, { wrapper: MockProviders });

		expect(screen.getByRole("status", { name: "Loading stats" })).toBeDefined();
		expect(screen.getByText("Loading stats...")).toBeDefined();
	});

	it("uses server-cached stats before polling to a fresh result", async () => {
		let getStatsCalls = 0;

		setupMockRPC({
			getStats: () => {
				getStatsCalls += 1;
				if (getStatsCalls === 1) {
					return Promise.resolve({ stats: makeStats(N_4), refreshing: true, cachedAt: "2026-04-22T10:00:00.000Z" });
				}
				return Promise.resolve({ stats: makeStats(N_7), refreshing: false, cachedAt: "2026-04-22T10:00:01.000Z" });
			},
		});

		render(<PackageDashboardStats />, { wrapper: MockProviders });

		await waitFor(() => {
			const projectsLabel = screen.getByText("Projects");
			expect(projectsLabel.previousSibling?.textContent).toBe("4");
		});
		expect(screen.getByText("Refreshing stats...")).toBeDefined();

		await waitFor(
			() => {
				expect(getStatsCalls).toBeGreaterThanOrEqual(2);
				const projectsLabel = screen.getByText("Projects");
				expect(projectsLabel.previousSibling?.textContent).toBe("7");
				expect(screen.queryByText("Refreshing stats...")).toBeNull();
			},
			{ timeout: N_2500 },
		);
	});

	it("updates when the desktop host pushes refreshed stats", async () => {
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
			listener?.(makeStats(N_9));
			await Promise.resolve();
		});

		await waitFor(() => {
			const projectsLabel = screen.getByText("Projects");
			expect(projectsLabel.previousSibling?.textContent).toBe("9");
		});
	});
});
