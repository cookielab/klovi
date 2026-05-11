import { cleanup, render } from "@testing-library/react";
import type { SessionSummary } from "../types/index";
import { SessionList } from "./SessionList";

const N_500 = 500;
const N_50 = 50;

afterEach(cleanup);

function makeSession(i: number): SessionSummary {
	return {
		sessionId: `s-${i}`,
		timestamp: "2025-01-15T10:00:00Z",
		slug: `slug-${i}`,
		firstMessage: `message ${i}`,
		model: "claude-sonnet-4-5-20250929",
		gitBranch: "main",
		pluginId: "claude-code",
	};
}

describe("SessionList virtualization", () => {
	it("renders only a windowed slice for large session lists", () => {
		const sessions = Array.from({ length: N_500 }, (_, i) => makeSession(i));
		const { container } = render(
			<div>
				<SessionList projectName="/Users/dev/x" sessions={sessions} onBack={mock()} onSelect={mock()} />
			</div>,
		);
		const items = container.querySelectorAll("[data-session-id]");
		expect(items.length).toBeLessThan(N_50);
		expect(items.length).toBeGreaterThan(0);
	});
});
