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
	afterEach(cleanup);

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
