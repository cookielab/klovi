import { afterEach, describe, expect, test } from "bun:test";
import { render } from "@testing-library/react";
import type { DashboardStats as Stats } from "../../../shared/types.ts";
import { DashboardStats } from "./DashboardStats.tsx";

function makeStats(overrides: Partial<Stats> = {}): Stats {
  return {
    projects: 5,
    sessions: 42,
    messages: 1_500,
    todaySessions: 3,
    thisWeekSessions: 12,
    inputTokens: 1_234_567,
    outputTokens: 456_789,
    cacheReadTokens: 100_000,
    cacheCreationTokens: 50_000,
    toolCalls: 3_210,
    models: {
      "claude-opus-4-6": {
        inputTokens: 800_000,
        outputTokens: 300_000,
        cacheReadTokens: 60_000,
        cacheCreationTokens: 30_000,
      },
      "claude-sonnet-4-5-20250929": {
        inputTokens: 434_567,
        outputTokens: 156_789,
        cacheReadTokens: 40_000,
        cacheCreationTokens: 20_000,
      },
    },
    ...overrides,
  };
}

function mockFetch(response: () => Promise<Response>): void {
  Object.assign(globalThis, {
    fetch: Object.assign(response, { preconnect: globalThis.fetch.preconnect }),
  });
}

let originalFetch: typeof globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("DashboardStats", () => {
  originalFetch = globalThis.fetch;

  test("renders loading skeletons initially", () => {
    const { container } = render(<DashboardStats />);
    const skeletons = container.querySelectorAll(".stat-card-skeleton");
    expect(skeletons.length).toBeGreaterThan(0);
  });

  test("renders stat cards with formatted values when data is provided", async () => {
    const stats = makeStats();
    mockFetch(() => Promise.resolve(new Response(JSON.stringify({ stats }), { status: 200 })));

    const { container, findByText } = render(<DashboardStats />);
    await findByText("1.2M");

    expect(container.querySelector(".dashboard-stats")).not.toBeNull();
  });

  test("renders messages count", async () => {
    const stats = makeStats({ messages: 5_000 });
    mockFetch(() => Promise.resolve(new Response(JSON.stringify({ stats }), { status: 200 })));

    const { findByText } = render(<DashboardStats />);
    await findByText("5,000");
  });

  test("renders today and this week sessions", async () => {
    const stats = makeStats({ todaySessions: 7, thisWeekSessions: 25 });
    mockFetch(() => Promise.resolve(new Response(JSON.stringify({ stats }), { status: 200 })));

    const { findByText } = render(<DashboardStats />);
    await findByText("7");
    await findByText("25");
  });

  test("formats token numbers with compact suffix", async () => {
    const stats = makeStats({ inputTokens: 9_876_543 });
    mockFetch(() => Promise.resolve(new Response(JSON.stringify({ stats }), { status: 200 })));

    const { findByText } = render(<DashboardStats />);
    await findByText("9.9M");
  });

  test("renders model breakdown with token counts", async () => {
    const stats = makeStats();
    mockFetch(() => Promise.resolve(new Response(JSON.stringify({ stats }), { status: 200 })));

    const { container, findAllByText } = render(<DashboardStats />);
    await findAllByText("opus-4-6");

    const modelList = container.querySelector(".model-list");
    expect(modelList).not.toBeNull();
    const items = modelList!.querySelectorAll("li");
    expect(items.length).toBe(2);
  });

  test("renders nothing on fetch error", async () => {
    mockFetch(() => Promise.reject(new Error("Network error")));

    const { container } = render(<DashboardStats />);
    // Wait for loading to finish
    await new Promise((r) => setTimeout(r, 50));

    // Should have no stat cards (not loading, no data)
    const skeletons = container.querySelectorAll(".stat-card-skeleton");
    const cards = container.querySelectorAll(".stat-card:not(.stat-card-skeleton)");
    expect(skeletons.length).toBe(0);
    expect(cards.length).toBe(0);
  });
});
