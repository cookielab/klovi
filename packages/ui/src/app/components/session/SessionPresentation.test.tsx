import { afterEach, describe, expect, test } from "bun:test";
import { cleanup, render, waitFor } from "@testing-library/react";
import type { Session } from "../../../shared/types.ts";
import { MockProviders, setupMockRPC } from "../../test-helpers/mock-rpc.ts";
import { SessionPresentation } from "./SessionPresentation.tsx";

const STEP_REGEX = /Step/u;

function makeSession(overrides: Partial<Session> = {}): Session {
	return {
		sessionId: "session-1",
		project: "test-project",
		turns: [
			{
				kind: "user",
				uuid: "u1",
				timestamp: "2025-01-15T10:00:00Z",
				text: "Hello",
			},
			{
				kind: "assistant",
				uuid: "a1",
				timestamp: "2025-01-15T10:00:01Z",
				model: "claude-opus-4-6",
				contentBlocks: [{ type: "text", text: "Response" }],
			},
		],
		...overrides,
	};
}

describe("SessionPresentation", () => {
	afterEach(cleanup);

	test("shows loading state initially", () => {
		setupMockRPC({
			getSession: () => new Promise(() => {}),
		});
		const { container } = render(
			// biome-ignore lint/nursery/noJsxPropsBind: test render prop
			<SessionPresentation sessionId="session-1" project="test-project" onExit={() => {}} />,
			{ wrapper: MockProviders },
		);
		expect(container.querySelector(".loading")).not.toBeNull();
	});

	test("renders presentation mode after fetch", async () => {
		const session = makeSession();
		setupMockRPC({
			getSession: () => Promise.resolve({ session: session }),
		});

		const { container, findByText } = render(
			// biome-ignore lint/nursery/noJsxPropsBind: test render prop
			<SessionPresentation sessionId="session-1" project="test-project" onExit={() => {}} />,
			{ wrapper: MockProviders },
		);
		await findByText(STEP_REGEX);
		expect(container.textContent).toContain("← → step");
	});

	test("renders progress bar", async () => {
		const session = makeSession();
		setupMockRPC({
			getSession: () => Promise.resolve({ session: session }),
		});

		const { container, findByText } = render(
			// biome-ignore lint/nursery/noJsxPropsBind: test render prop
			<SessionPresentation sessionId="session-1" project="test-project" onExit={() => {}} />,
			{ wrapper: MockProviders },
		);
		await findByText(STEP_REGEX);
		expect(container.textContent).toContain("Esc exit");
	});

	test("returns null when no session data", async () => {
		setupMockRPC({
			getSession: () => Promise.resolve({ session: null as unknown as Session }),
		});

		const { container } = render(
			// biome-ignore lint/nursery/noJsxPropsBind: test render prop
			<SessionPresentation sessionId="session-1" project="test-project" onExit={() => {}} />,
			{ wrapper: MockProviders },
		);
		await waitFor(() => {
			expect(container.querySelector(".loading")).toBeNull();
		});
		expect(container.textContent).not.toContain("← → step");
	});
});
